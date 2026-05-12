import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class AlertService {

  private toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  })

  constructor() {}

  success(titulo: string, mensaje: string, isToast: boolean = false) {
    if (isToast) {
      this.toast.fire({
        icon: 'success',
        title: mensaje ? `${titulo}: ${mensaje}` : titulo
      });
      return;
    }

    Swal.fire({
      title: titulo,
      text: mensaje,
      icon: 'success',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#0d9488',
      iconColor: '#0d9488'
    });
  }

  error(titulo: string, mensaje: string) {
    Swal.close();

    return Swal.fire({
      title: titulo,
      text: mensaje,
      icon: 'error',
      confirmButtonText: 'Intentar de nuevo',
      confirmButtonColor: '#ef4444',
      allowOutsideClick: false
    });
  }

  info(mensaje:string){
    this.toast.fire({
      icon: 'info',
      title: mensaje
    })
  }

loading(titulo: string = 'Procesando...', isToast: boolean = false) {
    // Si pasamos "true", mostramos un spinner chiquito en la esquina superior
    if (isToast) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        title: titulo,
        showConfirmButton: false,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      return;
    }

    Swal.fire({
      title: titulo,
      allowOutsideClick: false,
      showConfirmButton: false,
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
      cancelButtonColor: '#d33',
      reverseButtons: true,
    });
    return result.isConfirmed;
  }
}
