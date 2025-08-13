// تعريف HttpOnlyAuth على window

interface HttpOnlyAuth {
  new (baseUrl?: string): any;
  prototype: any;
}

interface Window {
  HttpOnlyAuth: HttpOnlyAuth;
} 