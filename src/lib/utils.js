import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getStatusBadge(status) {
  switch (status) {
    case 'disponivel':
      return {
        label: 'Disponível',
        className: 'bg-green-500 hover:bg-green-600',
      };
    case 'reservado':
      return {
        label: 'Reservado',
        className: 'bg-yellow-500 hover:bg-yellow-600',
      };
    case 'vendido':
      return {
        label: 'Contratado',
        className: 'bg-red-500 hover:bg-red-600',
      };
    default:
      return {
        label: 'Indefinido',
        className: 'bg-gray-500 hover:bg-gray-600',
      };
  }
}
