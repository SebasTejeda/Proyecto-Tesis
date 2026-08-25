import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

function calcularEdad(fechaNacimiento: Date, hoy: Date): number {
  let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
  const mes = hoy.getMonth() - fechaNacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) edad--;
  return edad;
}

export function fechaNacimientoValidator(edadMinima = 18, edadMaxima = 25): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (!valor) return null;

    const fechaNacimiento = new Date(valor);
    if (isNaN(fechaNacimiento.getTime())) return null;

    const hoy = new Date();
    if (fechaNacimiento > hoy) return { fechaFutura: true };

    const edad = calcularEdad(fechaNacimiento, hoy);
    if (edad < edadMinima || edad > edadMaxima) {
      return { edadFueraDeRango: { edadMinima, edadMaxima, edadActual: edad } };
    }
    return null;
  };
}
