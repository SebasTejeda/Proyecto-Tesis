import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, RegisterData, UserResponse } from '../../models/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  public fotoActualizada = new BehaviorSubject<string | null>(null);


  constructor() { }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token') || sessionStorage.getItem('token');
    }
    return null;
  }

  register(data: RegisterData): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.apiUrl}/users/`, data);
  }

  login(email: string, password: string, recordarme: boolean): Observable<AuthResponse> {
    const body = new HttpParams()
      .set('username', email)
      .set('password', password);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/token`, body, { headers }).pipe(
      tap(res => {
        if (res.access_token) {
          const storage = recordarme ? localStorage : sessionStorage;
          storage.setItem('token', res.access_token);
        }
      })
    );
  }

  loginWithGoogle(token: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/google`, { credential: token }).pipe(
      tap(res => sessionStorage.setItem('token', res.access_token))
    )
  }

  logout() {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getUserData() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const decoded: any = jwtDecode(token);
      return {
        nombre: decoded.name,
        foto: decoded.picture,
        email: decoded.sub
      };
    } catch{
      return null;
    }
  }

  getProfile(): Observable<UserResponse> {
    const headers = new HttpHeaders({
        'Authorization': `Bearer ${this.getToken()}`
    })
    return this.http.get<UserResponse>(`${this.apiUrl}/users/me/`, { headers });
  }

  updateProfile(data: FormData): Observable<UserResponse> {
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${this.getToken()}` });

    return this.http.put<UserResponse>(`${this.apiUrl}/users/me/`, data, { headers });
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
    // ¡La que usará Axel ahora mismo!
    return this.http.post(`${this.apiUrl}/auth/verify-account`, { email, codigo });
  }

}
