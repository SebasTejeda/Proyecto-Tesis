import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Nueva forma moderna de inyectar dependencias en Angular
  private http = inject(HttpClient);
  
  // La URL de tu backend
  private apiUrl = 'http://localhost:8000';

  constructor() { }

  login(correo: string, contrasena: string): Observable<any> {
    // Truco: FastAPI con OAuth2 espera 'FormData', no un JSON normal.
    const payload = new FormData();
    payload.append('username', correo); // FastAPI siempre busca el campo 'username', aunque mandemos email
    payload.append('password', contrasena);

    return this.http.post(`${this.apiUrl}/token`, payload).pipe(
      tap((response: any) => {
        // Guardamos el token en el navegador apenas llegue
        if (response.access_token) {
          localStorage.setItem('token', response.access_token);
        }
      })
    );
  }

  // Método útil para cerrar sesión
  logout() {
    localStorage.removeItem('token');
  }

  // Método para saber si estamos logueados
  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  getUserData() {
    const token = localStorage.getItem('token');
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
}