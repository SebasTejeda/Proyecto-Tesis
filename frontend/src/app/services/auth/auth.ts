import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';

export interface RegisterData {
  nombres: string;
  apellidos: string;
  email: string;
  password: string;
  codigo_colegiatura: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Nueva forma moderna de inyectar dependencias en Angular
  private http = inject(HttpClient);
  
  // La URL de tu backend
  private apiUrl = 'http://localhost:8000';

  constructor() { }

  register(data: RegisterData): Observable<any> {
    return this.http.post(`${this.apiUrl}/usuarios/`, data);
  }

  login(correo: string, contrasena: string, recordarme: boolean): Observable<any> {
    // Truco: FastAPI con OAuth2 espera 'FormData', no un JSON normal.
    const payload = new FormData();
    payload.append('username', correo); // FastAPI siempre busca el campo 'username', aunque mandemos email
    payload.append('password', contrasena);

    return this.http.post(`${this.apiUrl}/token`, payload).pipe(
      tap((response: any) => {
        // Guardamos el token en el navegador apenas llegue
        if (response.access_token) {
          if (recordarme) {
            localStorage.setItem('token', response.access_token);
          }
            sessionStorage.setItem('token', response.access_token);
        }
      })
    );
  }

  // Método útil para cerrar sesión
  logout() {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  }

  // Método para saber si estamos logueados
  isLoggedIn(): boolean {
    return !!(localStorage.getItem('token') || sessionStorage.getItem('token'));
  }

  getUserData() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        return {
          nombre: decoded.name,
          foto: decoded.picture,
          email: decoded.sub
        };
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  getProfile(): Observable<any> {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    if (!token) return new Observable(observer => {
      observer.error('No hay token');
    });

    const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`
    })

    return this.http.get(`${this.apiUrl}/users/me/`, { headers });
  }

  updateProfile(data: {nombre: string, apellidos:string, codigo_colegiatura: string}): Observable<any> {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    return this.http.put(`${this.apiUrl}/users/me/`, data, { headers });
  }

  // ... imports y variables anteriores ...

  // 1. Enviar correo con el código
  requestRecovery(email: string) {
    return this.http.post(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  // 2. Verificar si el código es correcto
  verifyCode(email: string, codigo: string) {
    return this.http.post(`${this.apiUrl}/auth/verify-code`, { email, codigo });
  }

  // 3. Establecer la nueva contraseña
  resetPassword(email: string, codigo: string, new_password: string) {
    return this.http.post(`${this.apiUrl}/auth/reset-password`, { 
      email, 
      codigo, 
      new_password 
    });
  }

  verifyAccount(email: string, codigo: string) {
    return this.http.post(`${this.apiUrl}/auth/verify-account`, { email, codigo });
  }

}
