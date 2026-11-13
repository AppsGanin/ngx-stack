import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { provideNgxStack } from '../provide';
import { NgxStackOutlet } from './stack-outlet';

@Component({ selector: 'ngx-lazy-page', template: '<p>lazy page</p>' })
class LazyPage {}

@Component({ selector: 'ngx-eager-page', template: '<p>eager page</p>' })
class EagerPage {}

@Component({
  imports: [NgxStackOutlet],
  template: '<ngx-stack-outlet />',
  styles: ':host { display: block; height: 600px; }',
})
class Host {}

async function render(url: string): Promise<string> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'eager', component: EagerPage },
        { path: 'lazy', loadComponent: () => Promise.resolve(LazyPage) },
      ]),
      provideNgxStack(),
    ],
  });
  const fixture = TestBed.createComponent(Host);
  await TestBed.inject(Router).navigateByUrl(url);
  await fixture.whenStable();
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('NgxStackOutlet', () => {
  it('hosts a route declared with component', async () => {
    expect(await render('/eager')).toContain('eager page');
  });

  it('hosts a route declared with loadComponent', async () => {
    expect(await render('/lazy')).toContain('lazy page');
  });
});
