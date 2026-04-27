import { CommonModule, TitleCasePipe } from '@angular/common';
import { ChangeDetectorRef, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth';
import { AlertService } from '../../services/alert/alert';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, TitleCasePipe],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);

  userName = signal<string>('Usuario');
  userPhoto = signal<string | null>(null);
  userInitial = computed(() => this.userName().charAt(0).toUpperCase());

  ngOnInit(): void {
    this.initUserProfile();
    this.listenToPhotoUpdates();
  }

  private initUserProfile() {
    const userData = this.authService.getUserData();
    if (userData) {
      this.userName.set(userData.nombre);
      const customPic = localStorage.getItem('custom_picture');
      this.userPhoto.set(customPic || userData.foto || null);
    }
  }

  private listenToPhotoUpdates() {
    this.authService.fotoActualizada.subscribe(nuevaFoto => {
      if (nuevaFoto) {
        this.userPhoto.set(nuevaFoto);
        this.cdr.detectChanges();
      }
    })
  }

  async logout() {
    const confirmado = await this.alertService.confirm('¿Cerrar sesión?', '¿Estás seguro de que deseas cerrar sesión?');
    if (confirmado) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }
}
