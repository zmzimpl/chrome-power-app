// types/models.d.ts

export namespace DB {
  export interface Window {

    id?: number;
    profile_id?: string;
    name?: string;
    group_id?: number;
    group_name?: string;
    tags?: number[] | string;
    remark?: string;
    opened_at?: string;
    created_at?: string;
    updated_at?: string;
    proxy_id?: number;
    ua?: string;
    cookie?: string;
    status?: number;

    ip?: string;
    port?: number;
    local_proxy_port?: number;

    proxy?: string;
    proxy_type?: string;
    ip_country?: string;
    ip_checker?: string;
    tags_name?: string[];
  }

  export interface Proxy {
    id?: number;
    ip?: string;
    proxy?: string;
    proxy_type?: string;
    ip_checker?: 'ip2location' | 'geoip';
    ip_country?: string;
    check_result?: string;
    checking?: boolean;
    remark?: string;
    // ... other properties
  }

  export interface Group {
    id?: number;
    name?: string;
  }

  export interface Tag {
    id?: number;
    name?: string;
    color?: strubg;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SafeAny = any;
