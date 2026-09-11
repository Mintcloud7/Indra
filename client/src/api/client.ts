const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: any, isFormData?: boolean): Promise<T> {
    const headers: Record<string, string> = {};

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (body) {
      config.body = isFormData ? body : JSON.stringify(body);
    }

    const res = await fetch(`${API_URL}${path}`, config);

    let raw: any;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      raw = await res.json();
    } else {
      raw = await res.text();
    }

    if (!res.ok) {
      const message = typeof raw === 'object' ? raw.message || raw.error || 'Request failed' : 'Request failed';
      throw new Error(message);
    }

    if (typeof raw === 'object' && raw !== null && 'success' in raw) {
      const { success, ...rest } = raw;
      if ('total' in raw || 'totalPages' in raw || 'pagination' in raw) {
        return rest as T;
      }
      return raw.data as T;
    }

    return raw as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: any, isFormData?: boolean): Promise<T> {
    return this.request<T>('POST', path, body, isFormData);
  }

  put<T>(path: string, body?: any): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async uploadFile<T>(path: string, file: File, fieldName: string = 'file'): Promise<T> {
    const formData = new FormData();
    formData.append(fieldName, file);
    return this.post<T>(path, formData, true);
  }
}

export const api = new ApiClient();
