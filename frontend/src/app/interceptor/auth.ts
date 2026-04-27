import { HttpInterceptorFn } from "@angular/common/http";
import { AuthService } from "../services/auth/auth";
import { inject } from "@angular/core/primitives/di";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const token = authService.getToken();

    if (token) {
        const cloned = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
        return next(cloned);
    }

    return next(req);
}
