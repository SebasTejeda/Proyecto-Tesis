import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, RegisterData, UserResponse } from '../../models/auth';
import { AlertService } from '../alert/alert';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private readonly apiUrl = environment.apiUrl;
  public fotoActualizada = new BehaviorSubject<string | null>(null);

  // Evita mostrar la alerta / redirigir más de una vez para el mismo cierre
  // de sesión (varias peticiones 401 simultáneas, o un 401 llegando casi al
  // mismo tiempo que el evento "storage" de otra pestaña).
  private sessionEndHandled = false;

  constructor() {
    // Si otra pestaña del mismo navegador borra el token (logout, sesión
    // reemplazada, etc.), esta pestaña se entera vía el evento "storage"
    // (solo se dispara en las pestañas QUE NO hicieron el cambio) y
    // redirige de inmediato, sin esperar a que su propia siguiente
    // petición falle con 401.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === 'token' && event.oldValue && !event.newValue) {
          this.handleSessionEnded('Sesión finalizada', 'Tu sesión ha finalizado. Inicia sesión nuevamente.');
        }
      });
    }
  }

  /** Cierra la sesión, avisa al usuario y redirige — una sola vez por cierre de sesión. */
  handleSessionEnded(titulo: string, mensaje: string): void {
    if (this.sessionEndHandled) return;
    this.sessionEndHandled = true;

    this.logout();
    this.alertService.error(titulo, mensaje);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token') || sessionStorage.getItem('token');
    }
    return null;
  }

  getRole(): string | null {
    return localStorage.getItem('role') || sessionStorage.getItem('role');
  }

  getAccountStatus(): string | null {
    return localStorage.getItem('account_status') || sessionStorage.getItem('account_status');
  }

  isAdmin(): boolean { return this.getRole() === 'Admin'; }
  isDoctor(): boolean { return this.getRole() === 'Doctor'; }
  isApproved(): boolean { return this.getAccountStatus() === 'approved'; }

  register(data: RegisterData): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.apiUrl}/users/`, data);
  }

  login(email: string, password: string, recordarme: boolean): Observable<AuthResponse> {
    const body = new HttpParams().set('username', email).set('password', password);
    const headers = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/token`, body, { headers }).pipe(
      tap(res => {
        if (res.access_token) {
          const storage = recordarme ? localStorage : sessionStorage;
          storage.setItem('token', res.access_token);
          storage.setItem('user_id', res.user_id.toString());
          storage.setItem('role', res.role);
          storage.setItem('account_status', (res as any).account_status ?? 'pending');
          this.sessionEndHandled = false;
        }
      })
    );
  }

  loginWithGoogle(token: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/google`, { credential: token }).pipe(
      tap(res => {
        localStorage.setItem('token', res.access_token);
        localStorage.setItem('user_id', res.user_id.toString());
        localStorage.setItem('role', res.role);
        localStorage.setItem('account_status', (res as any).account_status ?? 'pending');
        this.sessionEndHandled = false;
      })
    );
  }

  logout() {
    ['token', 'user_id', 'role', 'account_status'].forEach(k => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const decoded: any = jwtDecode(token);
      return decoded.exp * 1000 > Date.now();
    } catch { return false; }
  }

  getUserData() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const decoded: any = jwtDecode(token);
      return { nombre: decoded.name, foto: decoded.picture, email: decoded.sub };
    } catch { return null; }
  }

  getProfile(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.apiUrl}/users/me`);
  }

  updateProfile(data: FormData): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.apiUrl}/users/me`, data);
  }

  requestRecovery(email: string) {
    return this.http.post(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  verifyCode(email: string, codigo: string) {
    return this.http.post(`${this.apiUrl}/auth/verify-code`, { email, codigo });
  }

  resetPassword(email: string, codigo: string, new_password: string) {
    return this.http.post(`${this.apiUrl}/auth/reset-password`, { email, codigo, new_password });
  }

  verifyAccount(email: string, codigo: string) {
    return this.http.post(`${this.apiUrl}/auth/verify-account`, { email, codigo });
  }
}