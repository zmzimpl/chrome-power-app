import type { MenuProps } from 'antd';
import {
  Badge,
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  message,
} from 'antd';
import _, { debounce } from 'lodash';
import { useEffect, useState } from 'react';
import type { MenuInfo } from 'rc-menu/lib/interface';
import type { DB } from '../../../../shared/types/db';
import { ProxyBridge } from '#preload';
import type { SearchProps } from 'antd/es/input';
import { containsKeyword } from '/@/utils/str';
import {
  GlobalOutlined,
  MoreOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  EyeTwoTone,
  EyeInvisibleTwoTone,
  WifiOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PIN_URL } from '../../../../shared/constants';
import { MESSAGE_CONFIG } from '/@/constants';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WindowBridge } from '#preload';

type ProxyFormProps = {
  proxy_type?: string;
  ip_checker?: string;
  ip?: string;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  remark?: string;
};

type ProxyDBData = {
  // 代理的id
  id?: number | undefined;
  // 代理的ip
  ip?: string | null;
  // 代理的类型
  proxy?: string | null;
  // 代理的类型
  proxy_type?: string | null;
  // 代理的国家
  ip_country?: string | null;
  // 代理的可用性
  check_result?: string | null;
};

type CountryCode = {
  code: string;
  zh: string;
  icon: string;
  locale: string;
  isFirst?: boolean;
  initial?: string;
  en: string;
};

// 国家代码映射数组
const countryCodes: CountryCode[] = [
  {
    "code": "93",
    "zh": "阿富汗",
    "icon": "flag_af",
    "locale": "AF",
    "isFirst": true,
    "initial": "A",
    "en": "Afghanistan"
  },
  {
    "code": "355",
    "zh": "阿尔巴尼亚",
    "icon": "flag_al",
    "locale": "AL",
    "initial": "A",
    "en": "Albania"
  },
  {
    "code": "213",
    "zh": "阿尔及利亚",
    "icon": "flag_dz",
    "locale": "DZ",
    "initial": "A",
    "en": "Algeria"
  },
  {
    "code": "1",
    "zh": "美属萨摩亚",
    "icon": "flag_as",
    "locale": "AS",
    "initial": "A",
    "en": "American Samoa"
  },
  {
    "code": "376",
    "zh": "安道尔",
    "icon": "flag_ad",
    "locale": "AD",
    "initial": "A",
    "en": "Andorra"
  },
  {
    "code": "244",
    "zh": "安哥拉",
    "icon": "flag_ao",
    "locale": "AO",
    "initial": "A",
    "en": "Angola"
  },
  {
    "code": "1",
    "zh": "安圭拉",
    "icon": "flag_ai",
    "locale": "AI",
    "initial": "A",
    "en": "Anguilla"
  },
  {
    "code": "1",
    "zh": "安提瓜岛",
    "icon": "flag_ag",
    "locale": "AG",
    "initial": "A",
    "en": "Antigua"
  },
  {
    "code": "54",
    "zh": "阿根廷",
    "icon": "flag_ar",
    "locale": "AR",
    "initial": "A",
    "en": "Argentina"
  },
  {
    "code": "374",
    "zh": "亚美尼亚",
    "icon": "flag_am",
    "locale": "AM",
    "initial": "A",
    "en": "Armenia"
  },
  {
    "code": "297",
    "zh": "阿鲁巴",
    "icon": "flag_aw",
    "locale": "AW",
    "initial": "A",
    "en": "Aruba"
  },
  {
    "code": "61",
    "zh": "澳大利亚",
    "icon": "flag_au",
    "locale": "AU",
    "initial": "A",
    "en": "Australia"
  },
  {
    "code": "43",
    "zh": "奥地利",
    "icon": "flag_at",
    "locale": "AT",
    "initial": "A",
    "en": "Austria"
  },
  {
    "code": "994",
    "zh": "阿塞拜疆",
    "icon": "flag_az",
    "locale": "AZ",
    "initial": "A",
    "en": "Azerbaijan"
  },
  {
    "code": "973",
    "zh": "巴林",
    "icon": "flag_bh",
    "locale": "BH",
    "isFirst": true,
    "initial": "B",
    "en": "Bahrain"
  },
  {
    "code": "880",
    "zh": "孟加拉国",
    "icon": "flag_bd",
    "locale": "BD",
    "initial": "B",
    "en": "Bangladesh"
  },
  {
    "code": "1",
    "zh": "巴巴多斯岛",
    "icon": "flag_bb",
    "locale": "BB",
    "initial": "B",
    "en": "Barbados"
  },
  {
    "code": "375",
    "zh": "白俄罗斯",
    "icon": "flag_by",
    "locale": "BY",
    "initial": "B",
    "en": "Belarus"
  },
  {
    "code": "32",
    "zh": "比利时",
    "icon": "flag_be",
    "locale": "BE",
    "initial": "B",
    "en": "Belgium"
  },
  {
    "code": "501",
    "zh": "伯利兹",
    "icon": "flag_bz",
    "locale": "BZ",
    "initial": "B",
    "en": "Belize"
  },
  {
    "code": "229",
    "zh": "贝宁",
    "icon": "flag_bj",
    "locale": "BJ",
    "initial": "B",
    "en": "Benin"
  },
  {
    "code": "1",
    "zh": "百慕大",
    "icon": "flag_bm",
    "locale": "BM",
    "initial": "B",
    "en": "Bermuda"
  },
  {
    "code": "975",
    "zh": "不丹",
    "icon": "flag_bt",
    "locale": "BT",
    "initial": "B",
    "en": "Bhutan"
  },
  {
    "code": "591",
    "zh": "玻利维亚",
    "icon": "flag_bo",
    "locale": "BO",
    "initial": "B",
    "en": "Bolivia"
  },
  {
    "code": "599",
    "zh": "博内尔，圣尤斯特歇斯和沙巴",
    "icon": "flag_bq",
    "locale": "BQ",
    "initial": "B",
    "en": "Bonaire, Sint Eustatius and Saba"
  },
  {
    "code": "387",
    "zh": "波斯尼亚和黑塞哥维那",
    "icon": "flag_ba",
    "locale": "BA",
    "initial": "B",
    "en": "Bosnia and Herzegovina"
  },
  {
    "code": "267",
    "zh": "博茨瓦纳",
    "icon": "flag_bw",
    "locale": "BW",
    "initial": "B",
    "en": "Botswana"
  },
  {
    "code": "55",
    "zh": "巴西",
    "icon": "flag_br",
    "locale": "BR",
    "initial": "B",
    "en": "Brazil"
  },
  {
    "code": "246",
    "zh": "英属印度洋领地",
    "icon": "flag_io",
    "locale": "IO",
    "initial": "B",
    "en": "British Indian Ocean Territory"
  },
  {
    "code": "1",
    "zh": "英属维京群岛",
    "icon": "flag_vg",
    "locale": "VG",
    "initial": "B",
    "en": "British Virgin Islands"
  },
  {
    "code": "673",
    "zh": "文莱",
    "icon": "flag_bn",
    "locale": "BN",
    "initial": "B",
    "en": "Brunei"
  },
  {
    "code": "359",
    "zh": "保加利亚",
    "icon": "flag_bg",
    "locale": "BG",
    "initial": "B",
    "en": "Bulgaria"
  },
  {
    "code": "226",
    "zh": "布基纳法索",
    "icon": "flag_bf",
    "locale": "BF",
    "initial": "B",
    "en": "Burkina Faso"
  },
  {
    "code": "257",
    "zh": "布隆迪",
    "icon": "flag_bi",
    "locale": "BI",
    "initial": "B",
    "en": "Burundi"
  },
  {
    "code": "855",
    "zh": "柬埔寨",
    "icon": "flag_kh",
    "locale": "KH",
    "isFirst": true,
    "initial": "C",
    "en": "Cambodia"
  },
  {
    "code": "237",
    "zh": "喀麦隆",
    "icon": "flag_cm",
    "locale": "CM",
    "initial": "C",
    "en": "Cameroon"
  },
  {
    "code": "1",
    "zh": "加拿大",
    "icon": "flag_ca",
    "locale": "CA",
    "initial": "C",
    "en": "Canada"
  },
  {
    "code": "238",
    "zh": "佛得角",
    "icon": "flag_cv",
    "locale": "CV",
    "initial": "C",
    "en": "Cape Verde"
  },
  {
    "code": "1",
    "zh": "开曼群岛",
    "icon": "flag_ky",
    "locale": "KY",
    "initial": "C",
    "en": "Cayman Islands"
  },
  {
    "code": "236",
    "zh": "中非共和国",
    "icon": "flag_cf",
    "locale": "CF",
    "initial": "C",
    "en": "Central African Republic"
  },
  {
    "code": "235",
    "zh": "乍得",
    "icon": "flag_td",
    "locale": "TD",
    "initial": "C",
    "en": "Chad"
  },
  {
    "code": "56",
    "zh": "智利",
    "icon": "flag_cl",
    "locale": "CL",
    "initial": "C",
    "en": "Chile"
  },
  {
    "code": "86",
    "zh": "中国",
    "icon": "flag_cn",
    "locale": "CN",
    "initial": "C",
    "en": "China"
  },
  {
    "code": "57",
    "zh": "哥伦比亚",
    "icon": "flag_co",
    "locale": "CO",
    "initial": "C",
    "en": "Colombia"
  },
  {
    "code": "269",
    "zh": "科摩罗",
    "icon": "flag_km",
    "locale": "KM",
    "initial": "C",
    "en": "Comoros"
  },
  {
    "code": "682",
    "zh": "库克群岛",
    "icon": "flag_ck",
    "locale": "CK",
    "initial": "C",
    "en": "Cook Islands"
  },
  {
    "code": "506",
    "zh": "哥斯达黎加",
    "icon": "flag_cr",
    "locale": "CR",
    "initial": "C",
    "en": "Costa Rica"
  },
  {
    "code": "385",
    "zh": "克罗地亚",
    "icon": "flag_hr",
    "locale": "HR",
    "initial": "C",
    "en": "Croatia"
  },
  {
    "code": "53",
    "zh": "古巴",
    "icon": "flag_cu",
    "locale": "CU",
    "initial": "C",
    "en": "Cuba"
  },
  {
    "code": "599",
    "zh": "库拉索",
    "icon": "flag_cw",
    "locale": "CW",
    "initial": "C",
    "en": "Curaçao"
  },
  {
    "code": "357",
    "zh": "塞浦路斯",
    "icon": "flag_cy",
    "locale": "CY",
    "initial": "C",
    "en": "Cyprus"
  },
  {
    "code": "420",
    "zh": "捷克",
    "icon": "flag_cz",
    "locale": "CZ",
    "initial": "C",
    "en": "Czech Republic"
  },
  {
    "code": "225",
    "zh": "科特迪瓦",
    "icon": "flag_ci",
    "locale": "CI",
    "initial": "C",
    "en": "Côte d\\'Ivoire"
  },
  {
    "code": "243",
    "zh": "刚果民主共和国",
    "icon": "flag_cd",
    "locale": "CD",
    "isFirst": true,
    "initial": "D",
    "en": "Democratic Republic of the Congo"
  },
  {
    "code": "45",
    "zh": "丹麦",
    "icon": "flag_dk",
    "locale": "DK",
    "initial": "D",
    "en": "Denmark"
  },
  {
    "code": "253",
    "zh": "吉布提",
    "icon": "flag_dj",
    "locale": "DJ",
    "initial": "D",
    "en": "Djibouti"
  },
  {
    "code": "1",
    "zh": "多米尼加",
    "icon": "flag_dm",
    "locale": "DM",
    "initial": "D",
    "en": "Dominica"
  },
  {
    "code": "1",
    "zh": "多米尼加共和国",
    "icon": "flag_do",
    "locale": "DO",
    "initial": "D",
    "en": "Dominican Republic"
  },
  {
    "code": "593",
    "zh": "厄瓜多尔",
    "icon": "flag_ec",
    "locale": "EC",
    "isFirst": true,
    "initial": "E",
    "en": "Ecuador"
  },
  {
    "code": "20",
    "zh": "埃及",
    "icon": "flag_eg",
    "locale": "EG",
    "initial": "E",
    "en": "Egypt"
  },
  {
    "code": "503",
    "zh": "萨尔瓦多",
    "icon": "flag_sv",
    "locale": "SV",
    "initial": "E",
    "en": "El Salvador"
  },
  {
    "code": "240",
    "zh": "赤道几内亚",
    "icon": "flag_gq",
    "locale": "GQ",
    "initial": "E",
    "en": "Equatorial Guinea"
  },
  {
    "code": "291",
    "zh": "厄立特里亚",
    "icon": "flag_er",
    "locale": "ER",
    "initial": "E",
    "en": "Eritrea"
  },
  {
    "code": "372",
    "zh": "爱沙尼亚",
    "icon": "flag_ee",
    "locale": "EE",
    "initial": "E",
    "en": "Estonia"
  },
  {
    "code": "251",
    "zh": "埃塞俄比亚",
    "icon": "flag_et",
    "locale": "ET",
    "initial": "E",
    "en": "Ethiopia"
  },
  {
    "code": "500",
    "zh": "福克兰群岛",
    "icon": "flag_fk",
    "locale": "FK",
    "isFirst": true,
    "initial": "F",
    "en": "Falkland Islands"
  },
  {
    "code": "298",
    "zh": "法罗群岛",
    "icon": "flag_fo",
    "locale": "FO",
    "initial": "F",
    "en": "Faroe Islands"
  },
  {
    "code": "691",
    "zh": "密克罗尼西亚联邦",
    "icon": "flag_fm",
    "locale": "FM",
    "initial": "F",
    "en": "Federated States of Micronesia"
  },
  {
    "code": "679",
    "zh": "斐济",
    "icon": "flag_fj",
    "locale": "FJ",
    "initial": "F",
    "en": "Fiji"
  },
  {
    "code": "358",
    "zh": "芬兰",
    "icon": "flag_fi",
    "locale": "FI",
    "initial": "F",
    "en": "Finland"
  },
  {
    "code": "33",
    "zh": "法国",
    "icon": "flag_fr",
    "locale": "FR",
    "initial": "F",
    "en": "France"
  },
  {
    "code": "594",
    "zh": "法属圭亚那",
    "icon": "flag_gf",
    "locale": "GF",
    "initial": "F",
    "en": "French Guiana"
  },
  {
    "code": "689",
    "zh": "法属玻利尼西亚",
    "icon": "flag_pf",
    "locale": "PF",
    "initial": "F",
    "en": "French Polynesia"
  },
  {
    "code": "241",
    "zh": "加蓬",
    "icon": "flag_ga",
    "locale": "GA",
    "isFirst": true,
    "initial": "G",
    "en": "Gabon"
  },
  {
    "code": "995",
    "zh": "格鲁吉亚",
    "icon": "flag_ge",
    "locale": "GE",
    "initial": "G",
    "en": "Georgia"
  },
  {
    "code": "49",
    "zh": "德国",
    "icon": "flag_de",
    "locale": "DE",
    "initial": "G",
    "en": "Germany"
  },
  {
    "code": "233",
    "zh": "加纳",
    "icon": "flag_gh",
    "locale": "GH",
    "initial": "G",
    "en": "Ghana"
  },
  {
    "code": "350",
    "zh": "直布罗陀",
    "icon": "flag_gi",
    "locale": "GI",
    "initial": "G",
    "en": "Gibraltar"
  },
  {
    "code": "30",
    "zh": "希腊",
    "icon": "flag_gr",
    "locale": "GR",
    "initial": "G",
    "en": "Greece"
  },
  {
    "code": "299",
    "zh": "格陵兰",
    "icon": "flag_gl",
    "locale": "GL",
    "initial": "G",
    "en": "Greenland"
  },
  {
    "code": "1",
    "zh": "格林纳达",
    "icon": "flag_gd",
    "locale": "GD",
    "initial": "G",
    "en": "Grenada"
  },
  {
    "code": "590",
    "zh": "瓜德罗普岛",
    "icon": "flag_gp",
    "locale": "GP",
    "initial": "G",
    "en": "Guadeloupe"
  },
  {
    "code": "1",
    "zh": "关岛",
    "icon": "flag_gu",
    "locale": "GU",
    "initial": "G",
    "en": "Guam"
  },
  {
    "code": "502",
    "zh": "危地马拉",
    "icon": "flag_gt",
    "locale": "GT",
    "initial": "G",
    "en": "Guatemala"
  },
  {
    "code": "44",
    "zh": "根西岛",
    "icon": "flag_gg",
    "locale": "GG",
    "initial": "G",
    "en": "Guernsey"
  },
  {
    "code": "224",
    "zh": "几内亚",
    "icon": "flag_gn",
    "locale": "GN",
    "initial": "G",
    "en": "Guinea"
  },
  {
    "code": "245",
    "zh": "几内亚比绍共和国",
    "icon": "flag_gw",
    "locale": "GW",
    "initial": "G",
    "en": "Guinea-Bissau"
  },
  {
    "code": "592",
    "zh": "圭亚那",
    "icon": "flag_gy",
    "locale": "GY",
    "initial": "G",
    "en": "Guyana"
  },
  {
    "code": "509",
    "zh": "海地",
    "icon": "flag_ht",
    "locale": "HT",
    "isFirst": true,
    "initial": "H",
    "en": "Haiti"
  },
  {
    "code": "504",
    "zh": "洪都拉斯",
    "icon": "flag_hn",
    "locale": "HN",
    "initial": "H",
    "en": "Honduras"
  },
  {
    "code": "852",
    "zh": "香港",
    "icon": "flag_hk",
    "locale": "HK",
    "initial": "H",
    "en": "Hong Kong"
  },
  {
    "code": "36",
    "zh": "匈牙利",
    "icon": "flag_hu",
    "locale": "HU",
    "initial": "H",
    "en": "Hungary"
  },
  {
    "code": "354",
    "zh": "冰岛",
    "icon": "flag_is",
    "locale": "IS",
    "isFirst": true,
    "initial": "I",
    "en": "Iceland"
  },
  {
    "code": "91",
    "zh": "印度",
    "icon": "flag_in",
    "locale": "IN",
    "initial": "I",
    "en": "India"
  },
  {
    "code": "62",
    "zh": "印度尼西亚",
    "icon": "flag_id",
    "locale": "ID",
    "initial": "I",
    "en": "Indonesia"
  },
  {
    "code": "98",
    "zh": "伊朗",
    "icon": "flag_ir",
    "locale": "IR",
    "initial": "I",
    "en": "Iran"
  },
  {
    "code": "964",
    "zh": "伊拉克",
    "icon": "flag_iq",
    "locale": "IQ",
    "initial": "I",
    "en": "Iraq"
  },
  {
    "code": "353",
    "zh": "爱尔兰",
    "icon": "flag_ie",
    "locale": "IE",
    "initial": "I",
    "en": "Ireland"
  },
  {
    "code": "44",
    "zh": "马恩岛",
    "icon": "flag_im",
    "locale": "IM",
    "initial": "I",
    "en": "Isle Of Man"
  },
  {
    "code": "972",
    "zh": "以色列",
    "icon": "flag_il",
    "locale": "IL",
    "initial": "I",
    "en": "Israel"
  },
  {
    "code": "39",
    "zh": "意大利",
    "icon": "flag_it",
    "locale": "IT",
    "initial": "I",
    "en": "Italy"
  },
  {
    "code": "1",
    "zh": "牙买加",
    "icon": "flag_jm",
    "locale": "JM",
    "isFirst": true,
    "initial": "J",
    "en": "Jamaica"
  },
  {
    "code": "81",
    "zh": "日本",
    "icon": "flag_jp",
    "locale": "JP",
    "initial": "J",
    "en": "Japan"
  },
  {
    "code": "44",
    "zh": "泽西岛",
    "icon": "flag_je",
    "locale": "JE",
    "initial": "J",
    "en": "Jersey"
  },
  {
    "code": "962",
    "zh": "约旦",
    "icon": "flag_jo",
    "locale": "JO",
    "initial": "J",
    "en": "Jordan"
  },
  {
    "code": "7",
    "zh": "哈萨克斯坦",
    "icon": "flag_kz",
    "locale": "KZ",
    "isFirst": true,
    "initial": "K",
    "en": "Kazakhstan"
  },
  {
    "code": "254",
    "zh": "肯尼亚",
    "icon": "flag_ke",
    "locale": "KE",
    "initial": "K",
    "en": "Kenya"
  },
  {
    "code": "686",
    "zh": "基里巴斯",
    "icon": "flag_ki",
    "locale": "KI",
    "initial": "K",
    "en": "Kiribati"
  },
  {
    "code": "965",
    "zh": "科威特",
    "icon": "flag_kw",
    "locale": "KW",
    "initial": "K",
    "en": "Kuwait"
  },
  {
    "code": "996",
    "zh": "吉尔吉斯斯坦",
    "icon": "flag_kg",
    "locale": "KG",
    "initial": "K",
    "en": "Kyrgyzstan"
  },
  {
    "code": "856",
    "zh": "老挝",
    "icon": "flag_la",
    "locale": "LA",
    "isFirst": true,
    "initial": "L",
    "en": "Laos"
  },
  {
    "code": "371",
    "zh": "拉脱维亚",
    "icon": "flag_lv",
    "locale": "LV",
    "initial": "L",
    "en": "Latvia"
  },
  {
    "code": "961",
    "zh": "黎巴嫩",
    "icon": "flag_lb",
    "locale": "LB",
    "initial": "L",
    "en": "Lebanon"
  },
  {
    "code": "266",
    "zh": "莱索托",
    "icon": "flag_ls",
    "locale": "LS",
    "initial": "L",
    "en": "Lesotho"
  },
  {
    "code": "231",
    "zh": "利比亚",
    "icon": "flag_lr",
    "locale": "LR",
    "initial": "L",
    "en": "Liberia"
  },
  {
    "code": "218",
    "zh": "利比亞",
    "icon": "flag_ly",
    "locale": "LY",
    "initial": "L",
    "en": "Libya"
  },
  {
    "code": "423",
    "zh": "列支敦士登",
    "icon": "flag_li",
    "locale": "LI",
    "initial": "L",
    "en": "Liechtenstein"
  },
  {
    "code": "370",
    "zh": "立陶宛",
    "icon": "flag_lt",
    "locale": "LT",
    "initial": "L",
    "en": "Lithuania"
  },
  {
    "code": "352",
    "zh": "卢森堡",
    "icon": "flag_lu",
    "locale": "LU",
    "initial": "L",
    "en": "Luxembourg"
  },
  {
    "code": "853",
    "zh": "澳门",
    "icon": "flag_mo",
    "locale": "MO",
    "isFirst": true,
    "initial": "M",
    "en": "Macau"
  },
  {
    "code": "389",
    "zh": "马其顿",
    "icon": "flag_mk",
    "locale": "MK",
    "initial": "M",
    "en": "Macedonia"
  },
  {
    "code": "261",
    "zh": "马达加斯加",
    "icon": "flag_mg",
    "locale": "MG",
    "initial": "M",
    "en": "Madagascar"
  },
  {
    "code": "265",
    "zh": "马拉维",
    "icon": "flag_mw",
    "locale": "MW",
    "initial": "M",
    "en": "Malawi"
  },
  {
    "code": "60",
    "zh": "马来西亚",
    "icon": "flag_my",
    "locale": "MY",
    "initial": "M",
    "en": "Malaysia"
  },
  {
    "code": "960",
    "zh": "马尔代夫",
    "icon": "flag_mv",
    "locale": "MV",
    "initial": "M",
    "en": "Maldives"
  },
  {
    "code": "223",
    "zh": "马里",
    "icon": "flag_ml",
    "locale": "ML",
    "initial": "M",
    "en": "Mali"
  },
  {
    "code": "356",
    "zh": "马耳他",
    "icon": "flag_mt",
    "locale": "MT",
    "initial": "M",
    "en": "Malta"
  },
  {
    "code": "692",
    "zh": "马绍尔群岛",
    "icon": "flag_mh",
    "locale": "MH",
    "initial": "M",
    "en": "Marshall Islands"
  },
  {
    "code": "596",
    "zh": "马提尼克岛",
    "icon": "flag_mq",
    "locale": "MQ",
    "initial": "M",
    "en": "Martinique"
  },
  {
    "code": "222",
    "zh": "毛里塔尼亚",
    "icon": "flag_mr",
    "locale": "MR",
    "initial": "M",
    "en": "Mauritania"
  },
  {
    "code": "230",
    "zh": "毛里求斯",
    "icon": "flag_mu",
    "locale": "MU",
    "initial": "M",
    "en": "Mauritius"
  },
  {
    "code": "262",
    "zh": "马约特",
    "icon": "flag_yt",
    "locale": "YT",
    "initial": "M",
    "en": "Mayotte"
  },
  {
    "code": "52",
    "zh": "墨西哥",
    "icon": "flag_mx",
    "locale": "MX",
    "initial": "M",
    "en": "Mexico"
  },
  {
    "code": "373",
    "zh": "摩尔多瓦",
    "icon": "flag_md",
    "locale": "MD",
    "initial": "M",
    "en": "Moldova"
  },
  {
    "code": "377",
    "zh": "摩纳哥",
    "icon": "flag_mc",
    "locale": "MC",
    "initial": "M",
    "en": "Monaco"
  },
  {
    "code": "976",
    "zh": "蒙古",
    "icon": "flag_mn",
    "locale": "MN",
    "initial": "M",
    "en": "Mongolia"
  },
  {
    "code": "382",
    "zh": "黑山共和国",
    "icon": "flag_me",
    "locale": "ME",
    "initial": "M",
    "en": "Montenegro"
  },
  {
    "code": "1",
    "zh": "蒙塞拉特岛",
    "icon": "flag_ms",
    "locale": "MS",
    "initial": "M",
    "en": "Montserrat"
  },
  {
    "code": "212",
    "zh": "摩洛哥",
    "icon": "flag_ma",
    "locale": "MA",
    "initial": "M",
    "en": "Morocco"
  },
  {
    "code": "258",
    "zh": "莫桑比克",
    "icon": "flag_mz",
    "locale": "MZ",
    "initial": "M",
    "en": "Mozambique"
  },
  {
    "code": "95",
    "zh": "缅甸",
    "icon": "flag_mm",
    "locale": "MM",
    "initial": "M",
    "en": "Myanmar"
  },
  {
    "code": "264",
    "zh": "纳米比亚",
    "icon": "flag_na",
    "locale": "NA",
    "isFirst": true,
    "initial": "N",
    "en": "Namibia"
  },
  {
    "code": "674",
    "zh": "瑙鲁",
    "icon": "flag_nr",
    "locale": "NR",
    "initial": "N",
    "en": "Nauru"
  },
  {
    "code": "977",
    "zh": "尼泊尔",
    "icon": "flag_np",
    "locale": "NP",
    "initial": "N",
    "en": "Nepal"
  },
  {
    "code": "31",
    "zh": "荷兰",
    "icon": "flag_nl",
    "locale": "NL",
    "initial": "N",
    "en": "Netherlands"
  },
  {
    "code": "687",
    "zh": "新喀里多尼亚",
    "icon": "flag_nc",
    "locale": "NC",
    "initial": "N",
    "en": "New Caledonia"
  },
  {
    "code": "64",
    "zh": "新西兰",
    "icon": "flag_nz",
    "locale": "NZ",
    "initial": "N",
    "en": "New Zealand"
  },
  {
    "code": "505",
    "zh": "尼加拉瓜",
    "icon": "flag_ni",
    "locale": "NI",
    "initial": "N",
    "en": "Nicaragua"
  },
  {
    "code": "227",
    "zh": "尼日尔",
    "icon": "flag_ne",
    "locale": "NE",
    "initial": "N",
    "en": "Niger"
  },
  {
    "code": "234",
    "zh": "尼日利亚",
    "icon": "flag_ng",
    "locale": "NG",
    "initial": "N",
    "en": "Nigeria"
  },
  {
    "code": "683",
    "zh": "纽埃",
    "icon": "flag_nu",
    "locale": "NU",
    "initial": "N",
    "en": "Niue"
  },
  {
    "code": "672",
    "zh": "诺福克岛",
    "icon": "flag_nf",
    "locale": "NF",
    "initial": "N",
    "en": "Norfolk Island"
  },
  {
    "code": "850",
    "zh": "朝鲜",
    "icon": "flag_kp",
    "locale": "KP",
    "initial": "N",
    "en": "North Korea"
  },
  {
    "code": "1",
    "zh": "北马里亚纳群岛",
    "icon": "flag_mp",
    "locale": "MP",
    "initial": "N",
    "en": "Northern Mariana Islands"
  },
  {
    "code": "47",
    "zh": "挪威",
    "icon": "flag_no",
    "locale": "NO",
    "initial": "N",
    "en": "Norway"
  },
  {
    "code": "968",
    "zh": "阿曼",
    "icon": "flag_om",
    "locale": "OM",
    "isFirst": true,
    "initial": "O",
    "en": "Oman"
  },
  {
    "code": "92",
    "zh": "巴基斯坦",
    "icon": "flag_pk",
    "locale": "PK",
    "isFirst": true,
    "initial": "P",
    "en": "Pakistan"
  },
  {
    "code": "680",
    "zh": "帕劳",
    "icon": "flag_pw",
    "locale": "PW",
    "initial": "P",
    "en": "Palau"
  },
  {
    "code": "970",
    "zh": "巴勒斯坦",
    "icon": "flag_ps",
    "locale": "PS",
    "initial": "P",
    "en": "Palestine"
  },
  {
    "code": "507",
    "zh": "巴拿马",
    "icon": "flag_pa",
    "locale": "PA",
    "initial": "P",
    "en": "Panama"
  },
  {
    "code": "675",
    "zh": "巴布亚新几内亚",
    "icon": "flag_pg",
    "locale": "PG",
    "initial": "P",
    "en": "Papua New Guinea"
  },
  {
    "code": "595",
    "zh": "巴拉圭",
    "icon": "flag_py",
    "locale": "PY",
    "initial": "P",
    "en": "Paraguay"
  },
  {
    "code": "51",
    "zh": "秘鲁",
    "icon": "flag_pe",
    "locale": "PE",
    "initial": "P",
    "en": "Peru"
  },
  {
    "code": "63",
    "zh": "菲律宾",
    "icon": "flag_ph",
    "locale": "PH",
    "initial": "P",
    "en": "Philippines"
  },
  {
    "code": "48",
    "zh": "波兰",
    "icon": "flag_pl",
    "locale": "PL",
    "initial": "P",
    "en": "Poland"
  },
  {
    "code": "351",
    "zh": "葡萄牙",
    "icon": "flag_pt",
    "locale": "PT",
    "initial": "P",
    "en": "Portugal"
  },
  {
    "code": "1",
    "zh": "波多黎各",
    "icon": "flag_pr",
    "locale": "PR",
    "initial": "P",
    "en": "Puerto Rico"
  },
  {
    "code": "974",
    "zh": "卡塔尔",
    "icon": "flag_qa",
    "locale": "QA",
    "isFirst": true,
    "initial": "Q",
    "en": "Qatar"
  },
  {
    "code": "242",
    "zh": "刚果共和国",
    "icon": "flag_cg",
    "locale": "CG",
    "isFirst": true,
    "initial": "R",
    "en": "Republic of the Congo"
  },
  {
    "code": "40",
    "zh": "罗马尼亚",
    "icon": "flag_ro",
    "locale": "RO",
    "initial": "R",
    "en": "Romania"
  },
  {
    "code": "7",
    "zh": "俄罗斯",
    "icon": "flag_ru",
    "locale": "RU",
    "initial": "R",
    "en": "Russia"
  },
  {
    "code": "250",
    "zh": "卢旺达",
    "icon": "flag_rw",
    "locale": "RW",
    "initial": "R",
    "en": "Rwanda"
  },
  {
    "code": "262",
    "zh": "留尼汪",
    "icon": "flag_re",
    "locale": "RE",
    "initial": "R",
    "en": "Réunion"
  },
  {
    "code": "290",
    "zh": "圣赫勒拿",
    "icon": "flag_sh",
    "locale": "SH",
    "isFirst": true,
    "initial": "S",
    "en": "Saint Helena"
  },
  {
    "code": "1",
    "zh": "圣基茨和尼维斯",
    "icon": "flag_kn",
    "locale": "KN",
    "initial": "S",
    "en": "Saint Kitts and Nevis"
  },
  {
    "code": "508",
    "zh": "圣皮埃尔和密克隆",
    "icon": "flag_pm",
    "locale": "PM",
    "initial": "S",
    "en": "Saint Pierre and Miquelon"
  },
  {
    "code": "1",
    "zh": "圣文森特和格林纳丁斯",
    "icon": "flag_vc",
    "locale": "VC",
    "initial": "S",
    "en": "Saint Vincent and the Grenadines"
  },
  {
    "code": "685",
    "zh": "萨摩亚",
    "icon": "flag_ws",
    "locale": "WS",
    "initial": "S",
    "en": "Samoa"
  },
  {
    "code": "378",
    "zh": "圣马力诺",
    "icon": "flag_sm",
    "locale": "SM",
    "initial": "S",
    "en": "San Marino"
  },
  {
    "code": "239",
    "zh": "圣多美和普林西比",
    "icon": "flag_st",
    "locale": "ST",
    "initial": "S",
    "en": "Sao Tome and Principe"
  },
  {
    "code": "966",
    "zh": "沙特阿拉伯",
    "icon": "flag_sa",
    "locale": "SA",
    "initial": "S",
    "en": "Saudi Arabia"
  },
  {
    "code": "221",
    "zh": "塞内加尔",
    "icon": "flag_sn",
    "locale": "SN",
    "initial": "S",
    "en": "Senegal"
  },
  {
    "code": "381",
    "zh": "塞尔维亚",
    "icon": "flag_rs",
    "locale": "RS",
    "initial": "S",
    "en": "Serbia"
  },
  {
    "code": "248",
    "zh": "塞舌尔",
    "icon": "flag_sc",
    "locale": "SC",
    "initial": "S",
    "en": "Seychelles"
  },
  {
    "code": "232",
    "zh": "塞拉利昂",
    "icon": "flag_sl",
    "locale": "SL",
    "initial": "S",
    "en": "Sierra Leone"
  },
  {
    "code": "65",
    "zh": "新加坡",
    "icon": "flag_sg",
    "locale": "SG",
    "initial": "S",
    "en": "Singapore"
  },
  {
    "code": "1",
    "zh": "圣马丁岛",
    "icon": "flag_sx",
    "locale": "SX",
    "initial": "S",
    "en": "Sint Maarten"
  },
  {
    "code": "421",
    "zh": "斯洛伐克",
    "icon": "flag_sk",
    "locale": "SK",
    "initial": "S",
    "en": "Slovakia"
  },
  {
    "code": "386",
    "zh": "斯洛文尼亚",
    "icon": "flag_si",
    "locale": "SI",
    "initial": "S",
    "en": "Slovenia"
  },
  {
    "code": "677",
    "zh": "所罗门群岛",
    "icon": "flag_sb",
    "locale": "SB",
    "initial": "S",
    "en": "Solomon Islands"
  },
  {
    "code": "252",
    "zh": "索马里",
    "icon": "flag_so",
    "locale": "SO",
    "initial": "S",
    "en": "Somalia"
  },
  {
    "code": "27",
    "zh": "南非",
    "icon": "flag_za",
    "locale": "ZA",
    "initial": "S",
    "en": "South Africa"
  },
  {
    "code": "82",
    "zh": "韩国",
    "icon": "flag_kr",
    "locale": "KR",
    "initial": "S",
    "en": "South Korea"
  },
  {
    "code": "211",
    "zh": "南苏丹",
    "icon": "flag_ss",
    "locale": "SS",
    "initial": "S",
    "en": "South Sudan"
  },
  {
    "code": "34",
    "zh": "西班牙",
    "icon": "flag_es",
    "locale": "ES",
    "initial": "S",
    "en": "Spain"
  },
  {
    "code": "94",
    "zh": "斯里兰卡",
    "icon": "flag_lk",
    "locale": "LK",
    "initial": "S",
    "en": "Sri Lanka"
  },
  {
    "code": "1",
    "zh": "圣卢西亚",
    "icon": "flag_lc",
    "locale": "LC",
    "initial": "S",
    "en": "St. Lucia"
  },
  {
    "code": "249",
    "zh": "苏丹",
    "icon": "flag_sd",
    "locale": "SD",
    "initial": "S",
    "en": "Sudan"
  },
  {
    "code": "597",
    "zh": "苏里南",
    "icon": "flag_sr",
    "locale": "SR",
    "initial": "S",
    "en": "Suriname"
  },
  {
    "code": "268",
    "zh": "斯威士兰",
    "icon": "flag_sz",
    "locale": "SZ",
    "initial": "S",
    "en": "Swaziland"
  },
  {
    "code": "46",
    "zh": "瑞典",
    "icon": "flag_se",
    "locale": "SE",
    "initial": "S",
    "en": "Sweden"
  },
  {
    "code": "41",
    "zh": "瑞士",
    "icon": "flag_ch",
    "locale": "CH",
    "initial": "S",
    "en": "Switzerland"
  },
  {
    "code": "963",
    "zh": "叙利亚",
    "icon": "flag_sy",
    "locale": "SY",
    "initial": "S",
    "en": "Syria"
  },
  {
    "code": "886",
    "zh": "台湾",
    "icon": "flag_tw",
    "locale": "TW",
    "isFirst": true,
    "initial": "T",
    "en": "Taiwan"
  },
  {
    "code": "992",
    "zh": "塔吉克斯坦",
    "icon": "flag_tj",
    "locale": "TJ",
    "initial": "T",
    "en": "Tajikistan"
  },
  {
    "code": "255",
    "zh": "坦桑尼亚",
    "icon": "flag_tz",
    "locale": "TZ",
    "initial": "T",
    "en": "Tanzania"
  },
  {
    "code": "66",
    "zh": "泰国",
    "icon": "flag_th",
    "locale": "TH",
    "initial": "T",
    "en": "Thailand"
  },
  {
    "code": "1",
    "zh": "巴哈马",
    "icon": "flag_bs",
    "locale": "BS",
    "initial": "T",
    "en": "The Bahamas"
  },
  {
    "code": "220",
    "zh": "冈比亚",
    "icon": "flag_gm",
    "locale": "GM",
    "initial": "T",
    "en": "The Gambia"
  },
  {
    "code": "670",
    "zh": "东帝汶",
    "icon": "flag_tl",
    "locale": "TL",
    "initial": "T",
    "en": "Timor-Leste"
  },
  {
    "code": "228",
    "zh": "多哥",
    "icon": "flag_tg",
    "locale": "TG",
    "initial": "T",
    "en": "Togo"
  },
  {
    "code": "690",
    "zh": "托克劳",
    "icon": "flag_tk",
    "locale": "TK",
    "initial": "T",
    "en": "Tokelau"
  },
  {
    "code": "676",
    "zh": "汤加",
    "icon": "flag_to",
    "locale": "TO",
    "initial": "T",
    "en": "Tonga"
  },
  {
    "code": "1",
    "zh": "特立尼达和多巴哥",
    "icon": "flag_tt",
    "locale": "TT",
    "initial": "T",
    "en": "Trinidad and Tobago"
  },
  {
    "code": "216",
    "zh": "突尼斯",
    "icon": "flag_tn",
    "locale": "TN",
    "initial": "T",
    "en": "Tunisia"
  },
  {
    "code": "90",
    "zh": "土耳其",
    "icon": "flag_tr",
    "locale": "TR",
    "initial": "T",
    "en": "Turkey"
  },
  {
    "code": "993",
    "zh": "土库曼斯坦",
    "icon": "flag_tm",
    "locale": "TM",
    "initial": "T",
    "en": "Turkmenistan"
  },
  {
    "code": "1",
    "zh": "特克斯和凯科斯群岛",
    "icon": "flag_tc",
    "locale": "TC",
    "initial": "T",
    "en": "Turks and Caicos Islands"
  },
  {
    "code": "688",
    "zh": "图瓦卢",
    "icon": "flag_tv",
    "locale": "TV",
    "initial": "T",
    "en": "Tuvalu"
  },
  {
    "code": "1",
    "zh": "美属维京群岛",
    "icon": "flag_vi",
    "locale": "VI",
    "isFirst": true,
    "initial": "U",
    "en": "US Virgin Islands"
  },
  {
    "code": "256",
    "zh": "乌干达",
    "icon": "flag_ug",
    "locale": "UG",
    "initial": "U",
    "en": "Uganda"
  },
  {
    "code": "380",
    "zh": "乌克兰",
    "icon": "flag_ua",
    "locale": "UA",
    "initial": "U",
    "en": "Ukraine"
  },
  {
    "code": "971",
    "zh": "阿联酋",
    "icon": "flag_ae",
    "locale": "AE",
    "initial": "U",
    "en": "United Arab Emirates"
  },
  {
    "code": "44",
    "zh": "英国",
    "icon": "flag_gb",
    "locale": "GB",
    "initial": "U",
    "en": "United Kingdom"
  },
  {
    "code": "1",
    "zh": "美国",
    "icon": "flag_us",
    "locale": "US",
    "initial": "U",
    "en": "United States"
  },
  {
    "code": "598",
    "zh": "乌拉圭",
    "icon": "flag_uy",
    "locale": "UY",
    "initial": "U",
    "en": "Uruguay"
  },
  {
    "code": "998",
    "zh": "乌兹别克斯坦",
    "icon": "flag_uz",
    "locale": "UZ",
    "initial": "U",
    "en": "Uzbekistan"
  },
  {
    "code": "678",
    "zh": "瓦努阿图",
    "icon": "flag_vu",
    "locale": "VU",
    "isFirst": true,
    "initial": "V",
    "en": "Vanuatu"
  },
  {
    "code": "58",
    "zh": "委内瑞拉",
    "icon": "flag_ve",
    "locale": "VE",
    "initial": "V",
    "en": "Venezuela"
  },
  {
    "code": "84",
    "zh": "越南",
    "icon": "flag_vn",
    "locale": "VN",
    "initial": "V",
    "en": "Vietnam"
  },
  {
    "code": "681",
    "zh": "瓦利斯和富图纳群岛",
    "icon": "flag_wf",
    "locale": "WF",
    "isFirst": true,
    "initial": "W",
    "en": "Wallis and Futuna"
  },
  {
    "code": "212",
    "zh": "西撒哈拉",
    "icon": "flag_eh",
    "locale": "EH",
    "initial": "W",
    "en": "Western Sahara"
  },
  {
    "code": "967",
    "zh": "也门",
    "icon": "flag_ye",
    "locale": "YE",
    "isFirst": true,
    "initial": "Y",
    "en": "Yemen"
  },
  {
    "code": "260",
    "zh": "赞比亚",
    "icon": "flag_zm",
    "locale": "ZM",
    "isFirst": true,
    "initial": "Z",
    "en": "Zambia"
  },
  {
    "code": "263",
    "zh": "津巴布韦",
    "icon": "flag_zw",
    "locale": "ZW",
    "initial": "Z",
    "en": "Zimbabwe"
  }
]

// 创建 locale 到 zh 的映射表
const localeToZhMap = new Map<string, string>();
countryCodes.forEach((country) => {
  localeToZhMap.set(country.locale, country.zh);
});

// 将代理的JSON 数据转换为 CSV 格式
function jsonToCsv(data: ProxyDBData[], windowDataCopy: any[]): string {
  // 如果数据为空，直接返回空字符串
  if (data.length === 0) return "";

  // 定义需要保留的列名及其对应的中文名称
  const columns = {
    id: "id",
    proxy: "代理信息",
    ip: "出口ip",
    ip_country: "代理国家",
    check_result: "是否可用",
    关联窗口: "关联窗口" 
  };

  // 提取列名并转换为数组
  const columnNames = Object.values(columns);

  // 创建一个映射表，用于快速查找窗口数据
  const windowMap = new Map<number, string[]>();
  windowDataCopy.forEach((windowItem) => {
    if (windowItem.proxy_id) {
      if (!windowMap.has(windowItem.proxy_id)) {
        windowMap.set(windowItem.proxy_id, []);
      }
      windowMap.get(windowItem.proxy_id)!.push(windowItem.name);
    }
  });

  // 转换每一行数据为 CSV 格式
  const rows = data.map((item) => {
    // 合并 proxy_type 和 proxy
    const combinedProxy = item.proxy_type ? `${item.proxy_type.toLowerCase()}://${item.proxy}` : '';

    // 替换 ip_country 的值为中文名称
    const ipCountry = item.ip_country ? localeToZhMap.get(item.ip_country) || item.ip_country : '';

    // 检查 check_result 是否包含 "connected"
    const checkResult = item.check_result ? item.check_result.includes("connected") : false;

    // 获取关联窗口的名称
    const relatedWindows = item.id !== undefined ? windowMap.get(item.id) || [] : [];
    const relatedWindowsStr = relatedWindows.join(", "); // 用逗号分隔多个窗口名称

    // 提取需要的字段并转换为数组
    const row = [
      item.id,
      combinedProxy, // 合并后的 proxy 字段
      item.ip ?? "", // 如果 ip 是 null，用空字符串代替
      ipCountry, // 替换后的 ip_country 中文字段
      checkResult, // 如果 check_result 包含 "connected"，返回 true，否则返回 false
      relatedWindowsStr // 关联窗口的名称
    ];

    // 处理特殊字符并拼接为 CSV 格式
    return row.map((value) => {
      const formattedValue = value?.toString() || '';
      if (formattedValue.includes(",") || formattedValue.includes("\n") || formattedValue.includes('"')) {
        return `"${formattedValue.replace(/"/g, '""')}"`; // 转义双引号
      }
      return formattedValue;
    }).join(",");
  });

  // 将列名和数据行拼接成 CSV 格式的字符串
  const csvString = [columnNames.join(","), ...rows].join("\n");
  return csvString;
}

const jsonData: ProxyDBData[] = [];

const Proxy = () => {
  const { t } = useTranslation();
  const OFFSET = 266;
  const [searchValue, setSearchValue] = useState('');
  const [tableScrollY, setTableScrollY] = useState(window.innerHeight - OFFSET);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRow, setSelectedRow] = useState<DB.Proxy>();
  const [proxyData, setProxyData] = useState<DB.Proxy[]>([]);
  const [proxyDataCopy, setProxyDataCopy] = useState<DB.Proxy[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [messageApi, contextHolder] = message.useMessage(MESSAGE_CONFIG);
  const [form] = Form.useForm();
  const [formValue, setFormValue] = useState<ProxyFormProps>();
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState('');
  const navigate = useNavigate();
  const [windowDataCopy, setWindowDataCopy] = useState<DB.Window[]>([]);

  // 获取所有窗口数据
  const fetchWindowData = async () => {
    const data = await WindowBridge?.getAll();
    // 更新状态
    setWindowDataCopy(data);
  };

  useEffect(() => {
    fetchWindowData();
  }, []);


  const moreActionDropdownItems: MenuProps['items'] = [
    // {
    //   key: 'export',
    //   label: 'Export',
    //   icon: <ExportOutlined />,
    // },
    // {
    //   type: 'divider',
    // },
    {
      key: 'delete',
      danger: true,
      label: t('proxy_delete'),
      icon: <DeleteOutlined />,
    },
  ];

  const recorderDropdownItems: MenuProps['items'] = [
    {
      key: 'update',
      label: t('proxy_edit'),
      icon: <EditOutlined />,
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      danger: true,
      label: t('proxy_delete'),
      icon: <DeleteOutlined />,
    },
  ];

  // 设置页面显示的行数
  const [pageSize, setPageSize] = useState(20);

  function getStatus(checking: boolean, check_result: string, index: number) {
    if (checking) return 'processing';
    const connectivity = (check_result && JSON.parse(check_result)?.connectivity) || [];
    if (!connectivity[index]?.status) return 'default';
    return connectivity[index]?.status === 'connected' ? 'success' : 'error';
  }

  const columns: ColumnsType<DB.Proxy> = [
    {
      title: 'ID',
      width: 60,
      dataIndex: 'id',
      key: 'id',
      fixed: 'left',
    },
    {
      title: 'Host',
      width: 100,
      dataIndex: 'host',
      key: 'host',
      render: (_, recorder) => (
        <Space size={12}>{recorder.proxy}</Space>
      ),
    },
    {
      title: t('proxy_column_type'),
      dataIndex: 'proxy_type',
      key: 'proxy_type',
      width: 80,
    },
    {
      title: t('proxy_column_status'),
      key: 'status',
      width: 200,
      render: (_, recorder) => (
        <Space size={12}>
          {PIN_URL?.map((m, index: number) => (
            <Badge
              key={index}
              classNames={{ indicator: `w-[8px] h-[8px] ${recorder.checking ? 'animate-ping' : ''}` }}
              status={getStatus(!!recorder.checking, recorder.check_result!, index)}
              text={m.n}
            />
          ))}
        </Space>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 120,
      render: (_, recorder) =>
        recorder.ip ? (
          <Space size={12}>
            {recorder.ip}
            {recorder.ip_country}
          </Space>
        ) : (
          <Space size={12}>
            {recorder.check_result && JSON.parse(recorder.check_result)?.ipInfo?.ip}
            {recorder.check_result && JSON.parse(recorder.check_result)?.ipInfo?.country}
          </Space>
        ),
    },
    // {
    //   title: t('proxy_column_country'),
    //   dataIndex: 'ip_country',
    //   key: 'ip_country',
    //   width: 100,
    //   render: (_, recorder) => (
    //     <Space size={12}>
    //       {recorder.check_result && JSON.parse(recorder.check_result)?.ipInfo?.country}
    //     </Space>
    //   ),
    // },
    {
      title: t('proxy_column_remark'),
      dataIndex: 'remark',
      key: 'remark',
      width: 150,
    },
    {
      title: t('proxy_column_checker'),
      dataIndex: 'ip_checker',
      key: 'ip_checker',
      width: 150,
    },
    {
      title: '',
      key: 'operation',
      fixed: 'right',
      align: 'center',
      width: 60,
      render: (_, recorder) => (
        <Space size={24}>
          <WifiOutlined
            onClick={() => checkProxy(recorder.id)}
            className={`inline-block p-[8px] rounded-lg cursor-pointer ${recorder.checking ? 'animate-ping text-blue-500' : ''
              }`}
          />
          <Dropdown
            className="inline-block p-[8px] rounded-lg cursor-pointer"
            menu={{
              items: recorderDropdownItems,
              onClick: menuInfo => recorderAction(menuInfo, recorder),
            }}
          >
            <MoreOutlined />
          </Dropdown>
        </Space>
      ),
    },
  ];

  useEffect(() => {
    // 组件加载时从 localStorage 读取 pageSize
    const storedPageSize = localStorage.getItem('pageSizeProxy');
    if (storedPageSize) {
      setPageSize(Number(storedPageSize)); // 将字符串转换为数字
    }
    fetchProxyData();
  }, []);

  // 更新 pageSize 时保存到 localStorage
  const handlePageSizeChange = (newPage: number, newPageSize: number) => {
    setPageSize(newPageSize);
    localStorage.setItem('pageSizeProxy', newPageSize.toString()); // 保存到 localStorage
  };

  const recorderAction = (info: MenuInfo, recorder: DB.Proxy) => {
    switch (info.key) {
      case 'delete':
        setSelectedRow(recorder);
        deleteProxy();
        break;
      case 'update':
        {
          setSelectedRow(recorder);
          setUpdateCheckResult('');
          setUpdateChecking(false);
          const [host, port, username, password] = recorder?.proxy?.split(':') || [];
          if (form) {
            form.resetFields();
            form.setFieldsValue({
              proxy_type: recorder.proxy_type,
              ip_checker: recorder.ip_checker,
              host: host,
              port: port,
              username: username,
              password: password,
            });
          } else {
            setFormValue({
              proxy_type: recorder.proxy_type,
              ip_checker: recorder.ip_checker,
              ip: host,
              port: port,
              username: username,
              password: password,
            });
          }
          setUpdateModalVisible(true);
        }
        break;

      default:
        break;
    }
  };

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys as number[]);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const moreAction = (info: MenuInfo) => {
    switch (info.key) {
      case 'delete':
        setSelectedRow(undefined);
        deleteProxy();
        break;

      default:
        break;
    }
  };

  useEffect(() => {
    const handleResize = _.debounce(() => {
      setTableScrollY(window.innerHeight - OFFSET);
    }, 200);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 获取所有代理数据
  const fetchProxyData = async () => {
    // 设置加载状态为 true，表示正在加载数据
    setLoading(true);
    // 从 ProxyBridge 获取所有代理数据，等待异步操作完成
    const data = await ProxyBridge?.getAll();

    // 直接修改 data 数组中的每个对象的国家改成中文
    const updatedData = data.map((item: DB.Window) => ({
      ...item,
      ip_country: item.ip_country ? localeToZhMap.get(item.ip_country) || item.ip_country : ''
    }));

    // 将获取到的代理数据设置到状态中
    setProxyData(updatedData);
    // 复制代理数据到另一个状态，以便后续使用
    setProxyDataCopy(updatedData);
    // 设置加载状态为 false，表示数据加载完成
    setLoading(false);
  };

  const onSearch: SearchProps['onSearch'] = (value: string) => {
    if (value) {
      const keyword = value.toLowerCase();
      setProxyData(
        [...proxyDataCopy].filter(
          f =>
            containsKeyword(f.ip_country, keyword) ||
            containsKeyword(f.proxy, keyword) ||
            containsKeyword(f.ip, keyword) ||
            containsKeyword(f.proxy_type, keyword),
        ),
      );
    } else {
      fetchProxyData();
    }
  };

  const debounceSearch = debounce(value => {
    onSearch(value);
  }, 500);

  const handleSearchValueChange = (value: string) => {
    setSearchValue(value.trim());
    debounceSearch(value.trim());
  };

  const checkProxy = async (id?: number) => {
    if (id) {
      toggleCheckingStatus(true, id);
      const testResult = await ProxyBridge?.checkProxy(id);
      toggleCheckingStatus(false, id, testResult);
    } else {
      for (let index = 0; index < selectedRowKeys.length; index++) {
        const key = selectedRowKeys[index];
        toggleCheckingStatus(true, key);
        const testResult = await ProxyBridge?.checkProxy(key);
        toggleCheckingStatus(false, key, testResult);
      }
    }
  };

  const toggleCheckingStatus = (checking: boolean, id?: number, testResult?: string) => {
    setProxyData(
      [...proxyData].map(m => {
        if (id) {
          if (m.id === id) {
            m.checking = checking;
            if (testResult) {
              m.check_result = JSON.stringify(testResult);
            }
          }
        }
        return m;
      }),
    );
  };

  const onDeleteModalOk = async () => {
    const ids = selectedRow ? [selectedRow.id!] : selectedRowKeys;
    const result = await ProxyBridge?.batchDelete(ids);
    if (!result.success) {
      messageApi.error(result.message, result?.referencedIds?.join(', '));
    }
    setDeleteModalVisible(false);
    await fetchProxyData();
  };

  const onDeleteModalCancel = () => {
    setDeleteModalVisible(false);
  };

  const deleteProxy = () => {
    setDeleteModalVisible(true);
  };

  const newProxy = async () => {
    navigate('/proxy/import');
  };

  const onUpdateModalOk = async () => {
    form.validateFields().then(async values => {
      const proxy: DB.Proxy = {
        id: selectedRow?.id,
        proxy_type: values.proxy_type,
        ip_checker: values.ip_checker,
        // host: values.host,
        proxy:
          `${values.host}:${values.port}` +
          (values.username ? `:${values.username}:${values.password}` : ''),
        remark: values.remark,
      };
      const result = await ProxyBridge?.update(proxy.id!, proxy);
      if (!result) {
        messageApi.error('Failed to update proxy');
      } else {
        messageApi.success('Proxy updated successfully');
        setUpdateModalVisible(false);
        await fetchProxyData();
      }
    });
  };

  const onUpdateModalCancel = () => {
    setUpdateModalVisible(false);
  };

  const onUpdateModalCheck = () => {
    setUpdateChecking(true);
    form.validateFields().then(async values => {
      const testResult = await ProxyBridge?.checkProxy({
        proxy_type: values.proxy_type,
        ip_checker: values.ip_checker,
        host: values.host,
        proxy:
          `${values.host}:${values.port}` +
          (values.username ? `:${values.username}:${values.password}` : ''),
      });
      setUpdateCheckResult(JSON.stringify(testResult));
      setUpdateChecking(false);
    });
  };

  return (
    <>
      <div className="content-toolbar">
        {contextHolder}
        <Space size={16}>
          <Input
            value={searchValue}
            className="content-toolbar-search"
            placeholder="Search"
            onChange={e => handleSearchValueChange(e.target.value)}
            prefix={<SearchOutlined />}
          />
          <Button
            icon={<WifiOutlined />}
            onClick={() => checkProxy()}
            type="primary"
          >
            {t('proxy_check')}
          </Button>
          <Button
            type="default"
            onClick={async () => {
              await fetchProxyData();
              messageApi.success('Refreshed successfully');
            }}
            icon={<SyncOutlined />}
          >
            {t('refresh')}
          </Button>
        </Space>
        <Space
          size={8}
          className="content-toolbar-btns"
        >
          <Button
            icon={<GlobalOutlined />}
            onClick={() => newProxy()}
            type="primary"
          >
            {t('proxy_new_proxy')}
          </Button>
          <Button
            onClick={() => {
              console.log('proxyDataCopy', proxyDataCopy);

              // 导出代理数据

              console.log('windowDataCopy', windowDataCopy);
              const csvData = jsonToCsv(proxyDataCopy, windowDataCopy);
              const blob = new Blob([csvData], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'proxy_data.csv';
              a.click();
            }}
            type="primary"
          >
            导出代理
          </Button>
          <Dropdown
            menu={{
              items: moreActionDropdownItems,
              onClick: menuInfo => moreAction(menuInfo),
            }}
          >
            <Button
              type="default"
              className="rotate-90 font-black"
              icon={<MoreOutlined />}
            ></Button>
          </Dropdown>
        </Space>
      </div>
      <Card
        className="content-card"
        bordered={false}
      >
        <Table
          className="content-table"
          columns={columns}
          rowKey={'id'}
          loading={loading}
          rowSelection={rowSelection}
          dataSource={proxyData}
          scroll={{ x: 1500, y: tableScrollY }}
          pagination={{
            rootClassName: 'pagination-wrapper',
            pageSize: pageSize,
            pageSizeOptions: [20, 50, 100, 200, 500],
            showSizeChanger: true,
            onChange: handlePageSizeChange, // 改变页面显示的行数
          }}
        />
      </Card>
      <Modal
        title={
          <>
            <ExclamationCircleFilled
              style={{ color: '#faad14', fontSize: '22px', marginRight: '12px' }}
            ></ExclamationCircleFilled>
            <span>Delete IPs</span>
          </>
        }
        open={deleteModalVisible}
        centered
        onOk={onDeleteModalOk}
        onCancel={onDeleteModalCancel}
        closable={false}
        okText="Confirm"
        cancelText="Cancel"
      >
        <div className="pl-[36px]">
          <div>Are you sure you want to delete the selected IPs?</div>
        </div>
      </Modal>
      <Modal
        title="Update Proxy"
        open={updateModalVisible}
        centered
        width={560}
        onOk={onUpdateModalOk}
        onCancel={onUpdateModalCancel}
        closable={true}
        footer={[
          (updateChecking || updateCheckResult) && (
            <Space
              key="status"
              size={12}
              className="mr-4"
            >
              {PIN_URL?.map((m, index: number) => (
                <Badge
                  key={index}
                  classNames={{
                    indicator: `w-[8px] h-[8px] ${updateChecking ? 'animate-ping' : ''}`,
                  }}
                  status={getStatus(updateChecking, updateCheckResult, index)}
                  text={m.n}
                />
              ))}
            </Space>
          ),

          <Button
            key="check"
            loading={updateChecking}
            onClick={onUpdateModalCheck}
            type="link"
          >
            Check
          </Button>,
          <Button
            key="back"
            onClick={onUpdateModalCancel}
            type="default"
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={onUpdateModalOk}
          >
            Save
          </Button>,
        ]}
        okText="Save"
        cancelText="Cancel"
      >
        <div className="pr-16 pt-4">
          {/* Proxy Update Form */}
          <Form
            layout="horizontal"
            form={form}
            size="large"
            initialValues={formValue}
            labelCol={{ span: 6 }}
          >
            <Form.Item<ProxyFormProps>
              label="Proxy Type"
              name="proxy_type"
              rules={[{ required: true, message: 'Please Select Proxy Type!' }]}
            >
              <Select
                options={[
                  { label: 'Socks5', value: 'socks5' },
                  { label: 'Http', value: 'http' },
                ]}
              />
            </Form.Item>
            <Form.Item<ProxyFormProps>
              label="IP Checker"
              name="ip_checker"
              rules={[{ required: true, message: 'Please Select IP Checker!' }]}
            >
              <Select
                options={[
                  { label: 'Ip2Location', value: 'ip2location' },
                  { label: 'GeoIp', value: 'geoip' },
                ]}
              />
            </Form.Item>
            <Form.Item<ProxyFormProps>
              label="Host"
              name="host"
              rules={[{ required: true, message: 'Please input IP!' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item<ProxyFormProps>
              label="Port"
              name="port"
              rules={[{ required: true, message: 'Please input Port!' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item<ProxyFormProps>
              label="Username"
              name="username"
            >
              <Input />
            </Form.Item>
            <Form.Item<ProxyFormProps>
              label="Password"
              name="password"
            >
              <Input.Password
                iconRender={visible => (visible ? <EyeTwoTone /> : <EyeInvisibleTwoTone />)}
              />
            </Form.Item>
            <Form.Item<ProxyFormProps>
              label="Remark"
              name="remark"
            >
              <Input.TextArea style={{ height: 120, resize: 'none' }} />
            </Form.Item>
          </Form>
        </div>
      </Modal>
      <div className="content-footer"></div>
    </>
  );
};
export default Proxy;
