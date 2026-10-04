import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { AuthService } from "../services/auth/auth";
import { AlertService } from "../services/alert/alert";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { EMPTY, catchError, throwError } from "rxjs";

// Peticiones de login: un 401 aquí es "credenciales incorrectas", lo maneja
// la propia pantalla de login — nunca debe disparar el logout/redirect global.
const ES_PETICION_DE_LOGIN = (url: string) => url.includes('/auth/token') || url.includes('/auth/google');

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const alertService = inject(AlertService);
    const router = inject(Router);
    const token = authService.getToken();

    // 401 genérico (token vencido, borrado por otra pestaña, etc.) — no
    // aplica a /auth/token ni /auth/google, y no incluye el 423 (cuenta
    // suspendida) ni el 401 SESSION_REPLACED, que ya tienen su propio
    // manejo arriba/abajo con su propio mensaje.
    const manejarSesionExpirada = (err: HttpErrorResponse): boolean => {
        if (err.status !== 401 || ES_PETICION_DE_LOGIN(req.url)) return false;
        authService.handleSessionEnded('Sesión finalizada', 'Tu sesión ha finalizado. Inicia sesión nuevamente.');
        return true;
    };

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

                if (err.status === 401 && err.error?.detail === 'SESSION_REPLACED') {
                    // Sesión única: se inició sesión con esta cuenta en otro
                    // dispositivo/navegador, lo que invalidó este token.
                    authService.logout();
                    alertService.error('Sesión finalizada', 'Tu sesión se cerró porque se inició sesión en otro dispositivo');
                    router.navigate(['/login']);

                    return EMPTY;
                }

                if (manejarSesionExpirada(err)) return EMPTY;

                return throwError(() => err);
            })
        );
    }

    // Sin token: normalmente solo pasa en /login o pantallas públicas. Si de
    // todos modos llega un 401 (p. ej. el token se borró justo antes de
    // salir la petición), se maneja igual en vez de dejar que el componente
    // muestre su propio error genérico.
    return next(req).pipe(
        catchError((err: HttpErrorResponse) => {
            if (manejarSesionExpirada(err)) return EMPTY;
            return throwError(() => err);
        })
    );
}
