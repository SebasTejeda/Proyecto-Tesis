import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegisterAccount } from './register-account';

describe('RegisterAccount', () => {
  let component: RegisterAccount;
  let fixture: ComponentFixture<RegisterAccount>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterAccount]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterAccount);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
