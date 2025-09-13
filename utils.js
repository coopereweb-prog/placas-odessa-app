import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const getStatusBadge = (status) => {
  const statusConfig = {
    disponivel: { label: 'Disponível', className: 'bg-green-500 hover:bg-green-600' },
    reservado: { label: 'Reservado', className: 'bg-yellow-500 hover:bg-yellow-600' },
    vendido: { label: 'Vendido', className: 'bg-red-500 hover:bg-red-600' }
  };
  return statusConfig[status] || statusConfig.disponivel;
};