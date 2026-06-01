import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

export const adminGuard: CanActivateFn = () => {
    const router = inject(Router);
    const role = localStorage.getItem('role') || sessionStorage.getItem('role');
    if (role === 'Admin') return true;
    router.navigate(['/dashboard']);
    return false;
};

export const doctorGuard: CanActivateFn = () => {
    const router = inject(Router);
    const role = localStorage.getItem('role') || sessionStorage.getItem('role');
    if (role === 'Doctor') return true;
    router.navigate(['/admin']);
    return false;
};