import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterModule, Event, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth/auth';
import { AlertService } from '../../services/alert/alert';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, TitleCasePipe],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertService = inject(AlertService);

  userName = signal<string>('Administrador');
  userInitial = computed(() => this.userName().charAt(0).toUpperCase());
  
  // Controla el estado del menú en móviles
  isMobileMenuOpen = signal(false);

  ngOnInit() {
    const userData = this.authService.getUserData();
    if (userData) this.userName.set(userData.nombre);

    // Cierra el menú automáticamente cuando el usuario hace clic en un enlace y cambia de ruta
    this.router.events.pipe(
      filter((event: Event) => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.isMobileMenuOpen.set(false);
    });
  }

  toggleMenu() {
    this.isMobileMenuOpen.update(v => !v);
  }

  async logout() {
    const confirmado = await this.alertService.confirm('¿Cerrar sesión?', '¿Estás seguro?');
    if (confirmado) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }
}