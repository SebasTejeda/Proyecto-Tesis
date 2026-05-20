import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { RecoveryComponent } from './pages/recovery/recovery';
import { RegisterAccountComponent } from './pages/register-account/register-account';
import { SettingsComponent } from './pages/settings/settings';
import { ChangePasswordComponent } from './pages/change-password/change-password';
import { authGuard } from './guards/auth.guard';
import { publicGuard } from './guards/public.guard';
import { PatientDetailComponent } from './pages/patient-detail/patient-detail';
import { NotFoundComponent } from './pages/not-found/not-found';
import { MainLayoutComponent } from './layout/main-layout/main-layout';
import { ResumenComponent } from './pages/resumen/resumen';
import { RegisterComponent } from './pages/register/register';
import { EvaluationComponent } from './pages/evaluation/evaluation';
import { AuditoriaComponent } from './pages/auditoria/auditoria';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [publicGuard] },
  {
    path: 'recovery',
    component: RecoveryComponent,
    canActivate: [publicGuard],
  },
  {
    path: 'register',
    component: RegisterAccountComponent,
    canActivate: [publicGuard],
  },

  {
    path: 'change-password',
    component: ChangePasswordComponent,
    canActivate: [authGuard],
  },

  {
    path: 'dashboard',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: ResumenComponent },
      { path: 'registro', component: RegisterComponent },
      { path: 'evaluacion', component: EvaluationComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'patient/:id', component: PatientDetailComponent },
      {
        path: 'auditoria',
        component: AuditoriaComponent,
      },
    ],
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', component: NotFoundComponent },
];
