import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  constructor() {}

  success(titulo: string, mensaje: string) {
    Swal.fire({
      title: titulo,
      text: mensaje,
      icon: 'success',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#0d9488',
      background: '#ffffff',
      iconColor: '#0d9488'
    });
  }

  error(titulo: string, mensaje: string) {
    Swal.fire({
      title: titulo,
      text: mensaje,
      icon: 'error',
      confirmButtonText: 'Intentar de nuevo',
      confirmButtonColor: '#ef4444',
      background: '#ffffff'
    });
  }

  loading(titulo: string = 'Cargando...') {
    Swal.fire({
      title: titulo,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  close() {
    Swal.close();
  }

  async confirm(titulo: string, mensaje: string): Promise<boolean> {
    const result = await Swal.fire({
      title: titulo,
      text: mensaje,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      confirmButtonColor: '#0d9488',
      cancelButtonText: 'Cancelar',
      cancelButtonColor: '#d33'
    });
    return result.isConfirmed;
  }
}
