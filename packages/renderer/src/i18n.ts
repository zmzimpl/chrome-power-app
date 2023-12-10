import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {
          account_already_have: 'Account already have an account?',
          account_sign_in: 'Sign in',
          account_sign_up: 'Sign up',
          account_sign_out: 'Sign out',
          account_forgot_password: 'Forgot password?',
          account_reset_password: 'Reset password',
          account_do_not_have: "Don't have an account?",
          sign_in: 'Sign in',
          sign_up: 'Sign up',
          sign_out: 'Sign out',
          forgot_password: 'Forgot password',
          forgotten_password_desc:
            'Enter your email and we will send you a link to reset your password.',
          update_password: 'Update password',

          new_window: 'New window',
          edit_window: 'Edit window',

          window_open: 'Open',
          window_close: 'Close',
          window_edit: 'Edit',
          window_delete: 'Delete',
          window_proxy_setting: 'Proxy setting',
          window_running: 'Running',
          window_column_profile_id: 'Profile ID',
          window_column_proxy: 'Proxy',
          window_column_group: 'Group',
          window_column_remark: 'Remark',
          window_column_name: 'Name',
          window_column_tags: 'Tags',
          window_column_last_open: 'Last open',
          window_column_created_at: 'Created at',
          window_column_action: 'Action',
          window_edit_form_name: 'Name',
          window_edit_form_remark: 'Remark',
          window_edit_form_group: 'Group',
          window_edit_form_proxy: 'Proxy',
          window_edit_form_tags: 'Tags',
          window_detail_create: 'Create',
          window_detail_import: 'Import',
          window_import_from_template: 'Import from template',
          window_import_from_template_tip: 'Click to upload(Excel)',
          window_import_from_template_download: 'Download template',
          window_import_from_ads: 'Import AdsPower file',
          window_import_from_ads_tip: 'Click to upload(Txt/Excel)',

          proxy_check: 'Check',
          proxy_new_proxy: 'New proxy',
          proxy_edit: 'Edit',
          proxy_delete: 'Delete',
          proxy_column_type: 'Proxy Type',
          proxy_column_status: 'Status',
          proxy_column_country: 'IP Country',
          proxy_column_remark: 'Remark',
          proxy_column_checker: 'IP Checker',
          proxy_import_tip: `Instructions:
          1. If the proxy type is not specified, it will default to HTTP type.
          2. Only HTTP and SOCKS5 proxy types are supported.
          3. Enter one proxy per line.
          4. Only IPv4 addresses are supported for the host.
          Input format (IPv4 only):
          192.168.0.1:8000{remark}
          192.168.0.1:8000:proxy_username:proxy_password{remark}
          socks5://192.168.0.1:8000{remark}
          socks5://192.168.0.1:8000:proxy_username:proxy_password{remark}`,
          proxy_check_all: 'Check all',
          proxy_total: 'Total',
          proxy_import_column_type: 'Type',
          proxy_import_column_host: 'Host',
          proxy_import_column_port: 'Port',
          proxy_import_column_username: 'Username',
          proxy_import_column_password: 'Password',
          proxy_import_column_remark: 'Remark',
          proxy_import_column_status: 'Status',

          tile_windows: 'Tile window',

          settings_cache_path: 'Cache path',
          settings_choose_cache_path: 'Choose path',

          footer_ok: 'OK',
          footer_cancel: 'Cancel',

          new_proxy: 'New proxy',

          menu_windows: 'Windows',
          menu_proxy: 'Proxy',
          menu_settings: 'Settings',
          menu_logs: 'Running Logs',
          menu_sync: 'Sync',

          membership_renew: 'Renew',
          membership_upgrade: 'Upgrade',
          membership_window_count: 'Windows',

          header_language: 'Language',
          header_settings: 'Settings',
          header_sign_out: 'Sign out',
        },
      },
      zh: {
        translation: {
          account_already_have: '已有账号?',
          account_sign_in: '登录',
          account_sign_up: '注册',
          account_sign_out: '退出',
          account_forgot_password: '忘记密码?',
          account_reset_password: '重置密码',
          account_do_not_have: '没有账号?',
          sign_in: '登录',
          sign_up: '注册',
          sign_out: '退出',
          forgot_password: '忘记密码',
          forgotten_password_desc: '输入您的电子邮件，我们将向您发送重置密码的链接。',
          update_password: '更新密码',

          new_window: '新建窗口',
          edit_window: '编辑窗口',

          window_open: '打开',
          window_close: '关闭',
          window_edit: '编辑',
          window_delete: '删除',
          window_proxy_setting: '代理设置',
          window_running: '运行中',
          window_column_profile_id: '缓存目录',
          window_column_proxy: '代理',
          window_column_group: '分组',
          window_column_remark: '备注',
          window_column_name: '名称',
          window_column_tags: '标签',
          window_column_last_open: '最后打开',
          window_column_created_at: '创建时间',
          window_column_action: '操作',
          window_edit_form_name: '名称',
          window_edit_form_remark: '备注',
          window_edit_form_group: '分组',
          window_edit_form_proxy: '代理',
          window_edit_form_tags: '标签',
          window_detail_create: '创建',
          window_detail_import: '导入',
          window_import_from_template: '从模板导入',
          window_import_from_template_tip: '点击上传(Excel)',
          window_import_from_template_download: '下载模板',
          window_import_from_ads: '导入 AdsPower 文件',
          window_import_from_ads_tip: '点击上传(Txt/Excel)',

          proxy_check: '检查',
          proxy_new_proxy: '新建代理',
          proxy_edit: '编辑',
          proxy_delete: '删除',
          proxy_column_type: '代理类型',
          proxy_column_status: '状态',
          proxy_column_country: 'IP 地区',
          proxy_column_remark: '备注',
          proxy_column_checker: '检查方式',
          proxy_import_tip: `说明
          1. 如果未指定代理类型，则默认为 HTTP 类型。
          2. 仅支持 HTTP 和 SOCKS5 代理类型。
          3. 每行输入一个代理。
          4. 主机只支持 IPv4 地址。
          输入格式（仅限 IPv4）：
          192.168.0.1:8000{remark}
          192.168.0.1:8000:proxy_username:proxy_password{remark}
          socks5://192.168.0.1:8000{remark}
          socks5://192.168.0.1:8000:proxy_username:proxy_password{remark}`,
          proxy_check_all: '检查全部',
          proxy_total: '总数',
          proxy_import_column_type: '类型',
          proxy_import_column_host: '主机',
          proxy_import_column_port: '端口',
          proxy_import_column_username: '用户名',
          proxy_import_column_password: '密码',
          proxy_import_column_remark: '备注',
          proxy_import_column_status: '状态',

          tile_windows: '平铺窗口',

          settings_cache_path: '缓存目录',
          settings_choose_cache_path: '选择路径',

          footer_ok: '确定',
          footer_cancel: '取消',

          new_proxy: '新建代理',

          menu_windows: '窗口管理',
          menu_proxy: '代理设置',
          menu_sync: '同步操作',
          menu_logs: '运行日志',
          menu_settings: '设置',

          membership_renew: '续期',
          membership_upgrade: '升级',
          membership_window_count: '窗口数',

          header_settings: '设置',
          header_language: '语言',
          header_sign_out: '退出登录',
        },
      },
    },
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
