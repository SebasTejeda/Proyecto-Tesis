import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth/auth";
import { inject } from "@angular/core";

export const publicGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if(authService.isLoggedIn()){
        router.navigate(['/dashboard']);
        return false;
    }
    else{
        return true;
    }
};