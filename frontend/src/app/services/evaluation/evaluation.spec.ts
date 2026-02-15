import { TestBed } from '@angular/core/testing';

import { Evaluation } from './evaluation';

describe('Evaluation', () => {
  let service: Evaluation;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Evaluation);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
