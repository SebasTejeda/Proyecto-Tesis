import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, RegisterData, UserResponse } from '../../models/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  public fotoActualizada = new BehaviorSubject<string | null>(null);

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token') || sessionStorage.getItem('token');
    }
    return null;
  }

  getRole(): string | null {
    return localStorage.getItem('role') || sessionStorage.getItem('role');
  }

  isAdmin(): boolean {
    return this.getRole() === 'Admin';
  }

  isDoctor(): boolean {
    return this.getRole() === 'Doctor';
  }

  register(data: RegisterData): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.apiUrl}/users/`, data);
  }

  login(email: string, password: string, recordarme: boolean): Observable<AuthResponse> {
    const body = new HttpParams()
      .set('username', email)
      .set('password', password);
    const headers = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/token`, body, { headers }).pipe(
      tap(res => {
        if (res.access_token) {
          const storage = recordarme ? localStorage : sessionStorage;
          storage.setItem('token', res.access_token);
          storage.setItem('user_id', res.user_id.toString());
          storage.setItem('role', res.role);
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
      })
    );
  }

  logout() {
    ['token', 'user_id', 'role'].forEach(k => {
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
    return this.http.get<UserResponse>(`${this.apiUrl}/users/me/`);
  }

  updateProfile(data: FormData): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.apiUrl}/users/me/`, data);
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