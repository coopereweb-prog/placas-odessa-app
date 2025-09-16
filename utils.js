﻿import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const getStatusBadge = (status) => {
  const statusConfig = {
    available: { label: 'Disponível', className: 'bg-green-500 hover:bg-green-600' },
    reserved: { label: 'Reservado', className: 'bg-yellow-500 hover:bg-yellow-600' },
    sold: { label: 'Contratado', className: 'bg-red-500 hover:bg-red-600' },
  };
  return statusConfig[status] || statusConfig.available;
};
