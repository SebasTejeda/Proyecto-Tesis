import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const ZONA_HORARIA_CLINICA = 'America/Lima';

/**
 * Construye un Date "local" (medianoche) a partir de un string YYYY-MM-DD
 * (el formato que entrega <input type="date"> y el backend).
 *
 * OJO: no usar `new Date(valorString)` para esto — un string de solo fecha
 * se interpreta como medianoche UTC, y luego getMonth()/getDate() (que leen
 * en la zona horaria LOCAL del navegador) corren el día hacia atrás en
 * cualquier zona con offset negativo — America/Lima incluida (UTC-5). Ej.:
 * new Date('2004-02-29') con el navegador en Lima se lee de vuelta como
 * 28 de febrero, no 29.
 */
function parsearFechaLocal(valor: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (!match) return null;
  const anio = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const fecha = new Date(anio, mes - 1, dia);
  // Descarta fechas que no existen (ej. 31 de abril) — new Date las
  // "normaliza" corriéndolas al mes siguiente en vez de fallar.
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return null;
  }
  return fecha;
}

/**
 * "Hoy" en America/Lima como Date local — no depende de la zona horaria del
 * navegador del especialista (que podría no ser Lima).
 */
function hoyEnLima(): Date {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_CLINICA,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const obtener = (tipo: string) => Number(partes.find(p => p.type === tipo)?.value ?? 0);
  return new Date(obtener('year'), obtener('month') - 1, obtener('day'));
}

/** "Hoy" en America/Lima como string YYYY-MM-DD, para el atributo `max` del input. */
export function hoyEnLimaISO(): string {
  const h = hoyEnLima();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h.getFullYear()}-${pad(h.getMonth() + 1)}-${pad(h.getDate())}`;
}

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

    const fechaNacimiento = parsearFechaLocal(valor);
    if (!fechaNacimiento) return null;

    const hoy = hoyEnLima();
    if (fechaNacimiento > hoy) return { fechaFutura: true };

    const edad = calcularEdad(fechaNacimiento, hoy);
    if (edad < edadMinima || edad > edadMaxima) {
      return { edadFueraDeRango: { edadMinima, edadMaxima, edadActual: edad } };
    }
    return null;
  };
}
