import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth/auth";

// Guard para rutas del Doctor — si no está autenticado va a login, si es Admin va a /admin
export const doctorGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isLoggedIn()) {
        router.navigate(['/login']);
        return false;
    }

    const role = authService.getRole();

    if (role === 'Admin') {
        router.navigate(['/admin']);
        return false;
    }

    // Doctor o cualquier otro rol autenticado puede pasar
    return true;
};

// Guard para rutas del Admin — si no está autenticado va a login, si es Doctor va a /dashboard
export const adminGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isLoggedIn()) {
        router.navigate(['/login']);
        return false;
    }

    const role = authService.getRole();

    if (role !== 'Admin') {
        router.navigate(['/dashboard']);
        return false;
    }

    return true;
};