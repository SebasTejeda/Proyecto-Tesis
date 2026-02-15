import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { RecoveryComponent } from './pages/recovery/recovery';
import { RegisterAccountComponent } from './pages/register-account/register-account';
import { SettingsComponent } from './pages/settings/settings';
import { ChangePasswordComponent } from './pages/change-password/change-password';
import { authGuard } from './guards/auth.guard';
import { publicGuard } from './guards/public.guard';

export const routes: Routes = [
    {path: 'login', component: LoginComponent, canActivate: [publicGuard]},
    {path: 'dashboard', component: DashboardComponent, canActivate: [authGuard]},
    {path: 'recovery', component: RecoveryComponent, canActivate: [publicGuard]},
    {path: 'register', component: RegisterAccountComponent, canActivate: [publicGuard]},
    {path: 'settings', component: SettingsComponent, canActivate: [authGuard]},
    {path: 'change-password', component: ChangePasswordComponent, canActivate: [authGuard]},
    {path: '', redirectTo: 'login', pathMatch: 'full'},
    {path: '**', redirectTo: 'login'},
];
