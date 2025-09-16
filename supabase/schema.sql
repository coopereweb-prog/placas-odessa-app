

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."point_status" AS ENUM (
    'available',
    'reserved',
    'sold'
);


ALTER TYPE "public"."point_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'user'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'user'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_new_order"(
    customer_name text,
    customer_email text,
    customer_phone text,
    total_amount numeric,
    items jsonb
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_order_id uuid;
  item jsonb;
  point_uuid uuid;
  periodo integer;
  price numeric;
  point_status public.point_status;
  price_2y numeric;
  price_3y numeric;
  calculated_total numeric := 0;
BEGIN
  IF items IS NULL OR jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) = 0 THEN
    RAISE EXCEPTION 'Itens do pedido sao obrigatorios';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    point_uuid := (item->>'point_id')::uuid;
    IF point_uuid IS NULL THEN
      RAISE EXCEPTION 'Identificador do ponto ausente';
    END IF;

    SELECT status, price_2y, price_3y
    INTO point_status, price_2y, price_3y
    FROM public.points
    WHERE id = point_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ponto % nao encontrado', point_uuid;
    END IF;

    IF point_status <> 'available' THEN
      RAISE EXCEPTION 'Ponto % nao esta disponivel', point_uuid;
    END IF;

    periodo := (item->>'periodo_anos')::int;
    price := (item->>'price')::numeric;

    IF periodo NOT IN (2, 3) THEN
      RAISE EXCEPTION 'Periodo invalido para o ponto %', point_uuid;
    END IF;

    IF periodo = 2 THEN
      IF price_2y IS NULL THEN
        RAISE EXCEPTION 'Preco para 2 anos nao configurado para o ponto %', point_uuid;
      END IF;
      IF price IS NULL OR price <> price_2y THEN
        RAISE EXCEPTION 'Preco informado nao confere para o ponto %', point_uuid;
      END IF;
      calculated_total := calculated_total + price_2y;
    ELSE
      IF price_3y IS NULL THEN
        RAISE EXCEPTION 'Preco para 3 anos nao configurado para o ponto %', point_uuid;
      END IF;
      IF price IS NULL OR price <> price_3y THEN
        RAISE EXCEPTION 'Preco informado nao confere para o ponto %', point_uuid;
      END IF;
      calculated_total := calculated_total + price_3y;
    END IF;
  END LOOP;

  IF total_amount IS NULL OR total_amount <> calculated_total THEN
    RAISE EXCEPTION 'Valor total do pedido nao confere';
  END IF;

  INSERT INTO public.orders (customer_name, customer_email, customer_phone, total_amount, status)
  VALUES (customer_name, customer_email, customer_phone, total_amount, 'pending')
  RETURNING id INTO new_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    point_uuid := (item->>'point_id')::uuid;
    periodo := (item->>'periodo_anos')::int;
    price := (item->>'price')::numeric;

    INSERT INTO public.order_items (order_id, point_id, periodo_anos, price)
    VALUES (new_order_id, point_uuid, periodo, price);

    UPDATE public.points
    SET status = 'reserved',
        reserved_until = NOW() + INTERVAL '48 hours',
        sold_until = NULL,
        updated_at = NOW()
    WHERE id = point_uuid;
  END LOOP;

  RETURN new_order_id;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."confirm_order_and_update_points"(p_order_id "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  order_status text;
  item_record RECORD;
  point_status public.point_status;
BEGIN
  SELECT status
  INTO order_status
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % nao encontrado', p_order_id;
  END IF;

  IF order_status <> 'pending' THEN
    RAISE EXCEPTION 'Somente pedidos pendentes podem ser confirmados';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'Pedido % nao possui itens', p_order_id;
  END IF;

  FOR item_record IN
    SELECT oi.point_id, oi.periodo_anos
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    SELECT status
    INTO point_status
    FROM public.points
    WHERE id = item_record.point_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ponto % nao encontrado', item_record.point_id;
    END IF;

    IF point_status <> 'reserved' THEN
      RAISE EXCEPTION 'Ponto % nao esta reservado', item_record.point_id;
    END IF;

    UPDATE public.points
    SET status = 'sold',
        sold_until = NOW() + make_interval(years => item_record.periodo_anos),
        reserved_until = NULL,
        updated_at = NOW()
    WHERE id = item_record.point_id;
  END LOOP;

  UPDATE public.orders
  SET status = 'completed',
      updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."revert_order_and_release_points"(p_order_id "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  order_status text;
  item_record RECORD;
  point_status public.point_status;
BEGIN
  SELECT status
  INTO order_status
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % nao encontrado', p_order_id;
  END IF;

  IF order_status <> 'pending' THEN
    RAISE EXCEPTION 'Somente pedidos pendentes podem ser cancelados';
  END IF;

  FOR item_record IN
    SELECT oi.point_id
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    SELECT status
    INTO point_status
    FROM public.points
    WHERE id = item_record.point_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ponto % nao encontrado', item_record.point_id;
    END IF;

    IF point_status <> 'reserved' THEN
      RAISE EXCEPTION 'Ponto % nao esta reservado', item_record.point_id;
    END IF;

    UPDATE public.points
    SET status = 'available',
        reserved_until = NULL,
        updated_at = NOW()
    WHERE id = item_record.point_id;
  END LOOP;

  UPDATE public.orders
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "point_id" "uuid",
    "periodo_anos" integer NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "total_amount" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "payment_receipt_url" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_name" "text",
    "customer_email" "text",
    "customer_phone" "text",
    "point_id" "uuid",
    "period_years" numeric
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."point_status" DEFAULT 'available'::"public"."point_status",
    "price" numeric(10,2) DEFAULT 0,
    "reserved_until" timestamp with time zone,
    "sold_until" timestamp with time zone,
    "image_url" "text",
    "reserved_by" "uuid",
    "company_name" "text",
    "installation_photo_url" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "price_2y" numeric(10,2),
    "price_3y" numeric(10,2)
);


ALTER TABLE "public"."points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."points"
    ADD CONSTRAINT "points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_points_updated_at" BEFORE UPDATE ON "public"."points" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_point_id_fkey" FOREIGN KEY ("point_id") REFERENCES "public"."points"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."points"
    ADD CONSTRAINT "points_reserved_by_fkey" FOREIGN KEY ("reserved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin Insert Policy" ON "public"."points" FOR INSERT WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."user_role"));



CREATE POLICY "Admins can update any profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("public"."get_current_user_role"() = 'admin'::"text"));



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("public"."get_current_user_role"() = 'admin'::"text"));



CREATE POLICY "Deny anonymous access to profiles" ON "public"."profiles" TO "anon" USING (false);



CREATE POLICY "Only admins can delete points" ON "public"."points" FOR DELETE USING (("public"."get_current_user_role"() = 'admin'::"text"));



CREATE POLICY "Permitir atualização do status" ON "public"."points" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Permitir criação de order_itens" ON "public"."order_items" FOR INSERT WITH CHECK (true);



CREATE POLICY "Permitir criação de orders" ON "public"."orders" FOR INSERT WITH CHECK (true);



CREATE POLICY "Permitir leitura pública dos pontos" ON "public"."points" FOR SELECT USING (true);



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own profile (no role change)" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK ((("auth"."uid"() = "id") AND ("role" = 'user'::"public"."user_role")));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_order_and_update_points"("uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_order_and_update_points"("uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_new_order"(text, text, text, numeric, jsonb) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_new_order"(text, text, text, numeric, jsonb) TO "service_role";

GRANT ALL ON FUNCTION "public"."revert_order_and_release_points"("uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revert_order_and_release_points"("uuid") TO "service_role";
















GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."points" TO "anon";
GRANT ALL ON TABLE "public"."points" TO "authenticated";
GRANT ALL ON TABLE "public"."points" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
