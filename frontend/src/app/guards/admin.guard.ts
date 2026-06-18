import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth/auth";

// Guard para rutas del Doctor
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

    // Verificar que la cuenta esté aprobada
    const status = authService.getAccountStatus();
    if (status === 'pending') {
        router.navigate(['/pending-approval']);
        return false;
    }
    if (status === 'rejected') {
        router.navigate(['/account-rejected']);
        return false;
    }

    return true;
};

// Guard para rutas del Admin
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

// Guard para pantallas de estado (pending/rejected) — evita que aprobados accedan
export const pendingGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isLoggedIn()) {
        router.navigate(['/login']);
        return false;
    }

    const status = authService.getAccountStatus();
    if (status === 'approved') {
        router.navigate(['/dashboard']);
        return false;
    }

    return true;
};