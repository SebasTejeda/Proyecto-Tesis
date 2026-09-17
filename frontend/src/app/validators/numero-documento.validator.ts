import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const PATRONES: Record<string, RegExp> = {
  DNI: /^[0-9]{8}$/,
  CE: /^[A-Za-z0-9]{9,12}$/,
};

export function numeroDocumentoValidator(tipoDocumentoField = 'tipo_documento'): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (!valor) return null;

    const tipo = control.parent?.get(tipoDocumentoField)?.value ?? 'DNI';
    const patron = PATRONES[tipo] ?? PATRONES['DNI'];
    return patron.test(valor) ? null : { numeroDocumentoInvalido: { tipo } };
  };
}
