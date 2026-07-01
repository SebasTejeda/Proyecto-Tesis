import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

interface ActivityLog {
  id: number;
  fecha: string;
  usuario_email: string;
  usuario_nombre: string;
  accion: string;
  accion_key: string;
  detalle: string;
  ip: string;
}

interface AccionTipo {
  key: string;
  label: string;
}

@Component({
  selector: 'app-actividad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './actividad.component.html',
  styleUrls: ['./actividad.component.css']
})
export class ActividadComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  logs = signal<ActivityLog[]>([]);
  acciones = signal<AccionTipo[]>([]);
  isLoading = signal(true);

  filtroAccion = signal('');
  filtroBusqueda = signal('');

  logsFiltrados = computed(() => {
    let result = this.logs();
    const accion = this.filtroAccion();
    const busqueda = this.filtroBusqueda().toLowerCase().trim();

    if (accion) result = result.filter(l => l.accion_key === accion);
    if (busqueda) result = result.filter(l =>
      l.usuario_email.toLowerCase().includes(busqueda) ||
      l.usuario_nombre.toLowerCase().includes(busqueda) ||
      l.ip.includes(busqueda)
    );
    return result;
  });

  ngOnInit() {
    this.cargarLogs();
    this.cargarAcciones();
  }

  cargarLogs() {
    this.isLoading.set(true);
    this.http.get<ActivityLog[]>(`${this.apiUrl}/admin/logs/`).subscribe({
      next: (data) => { this.logs.set(data); this.isLoading.set(false); },
      error: () => { this.isLoading.set(false); }
    });
  }

  cargarAcciones() {
    this.http.get<AccionTipo[]>(`${this.apiUrl}/admin/logs/acciones`).subscribe({
      next: (data) => this.acciones.set(data)
    });
  }

  formatearFecha(fechaStr: string): string {
    const fecha = new Date(fechaStr.endsWith('Z') ? fechaStr : fechaStr + 'Z');
    return fecha.toLocaleString('es-PE', {
      timeZone: 'America/Lima', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  getAccionClass(key: string): string {
    if (key === 'login' || key === 'login_google') return 'accion-login';
    if (key === 'logout') return 'accion-logout';
    if (key === 'account_locked') return 'accion-locked';
    return 'accion-default';
  }

  getAccionIcon(key: string): string {
    if (key === 'login' || key === 'login_google') return 'pi-sign-in';
    if (key === 'logout') return 'pi-sign-out';
    if (key === 'account_locked') return 'pi-lock';
    return 'pi-circle';
  }

  limpiarFiltros() {
    this.filtroAccion.set('');
    this.filtroBusqueda.set('');
  }
}