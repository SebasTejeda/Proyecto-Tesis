import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { RecoveryComponent } from './pages/recovery/recovery';
import { RegisterAccountComponent } from './pages/register-account/register-account';

export const routes: Routes = [
    {path: 'login', component: LoginComponent},
    {path: '', redirectTo: 'login', pathMatch: 'full'},
    {path: 'dashboard', component: DashboardComponent},
    {path: 'recovery', component: RecoveryComponent},
    {path: 'register', component: RegisterAccountComponent}
];
