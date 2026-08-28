import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { AuthService } from "../services/auth/auth";
import { AlertService } from "../services/alert/alert";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { EMPTY, catchError, throwError } from "rxjs";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const alertService = inject(AlertService);
    const router = inject(Router);
    const token = authService.getToken();

    if (token) {
        const cloned = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });

        return next(cloned).pipe(
            catchError((err: HttpErrorResponse) => {
                if (err.status === 423) {
                    // Cuenta suspendida o eliminada: la sesión ya no es válida.
                    const detail: string = err.error?.detail || 'Tu cuenta ya no tiene acceso al sistema. Contacta al administrador.';

                    authService.logout();
                    alertService.error('Acceso restringido', detail);
                    router.navigate(['/login']);

                    // Se evita propagar el error para que los componentes no
                    // muestren además su propio mensaje genérico de fallo.
                    return EMPTY;
                }

                return throwError(() => err);
            })
        );
    }

    return next(req);
}
