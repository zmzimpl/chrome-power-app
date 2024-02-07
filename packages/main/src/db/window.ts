import {db} from '.';
import type {DB, SafeAny} from '../../../shared/types/db';
import type {IWindowTemplate} from '../types/windowTemplate';
import {GroupDB} from './group';
import {ProxyDB} from './proxy';
import {generateUniqueProfileId} from '../../../shared/utils/randomProfileId';
import {dataStore} from '../../../shared/utils/dataStore';
import api from '../../../shared/api/api';

const all = async () => {
  return await db('window')
    .select(
      'window.id',
      'window.group_id',
      'window.proxy_id',
      'window.tags',
      'window.name',
      'window.remark',
      'window.created_at',
      'window.updated_at',
      'window.profile_id',
      'window.opened_at',
      'window.ua',
      'window.status',
      'group.name as group_name',
      'proxy.ip',
      'proxy.proxy',
      'proxy.proxy_type',
      'proxy.ip_country',
      'proxy.ip_checker',
    )
    .leftJoin('group', 'window.group_id', '=', 'group.id')
    .leftJoin('proxy', 'window.proxy_id', '=', 'proxy.id')
    .where('window.status', '>', 0)
    .orderBy('window.created_at', 'desc');
};

const getOpenedWindows = async () => {
  return await db('window')
    .select(
      'window.id',
      'window.group_id',
      'window.proxy_id',
      'window.tags',
      'window.name',
      'window.remark',
      'window.created_at',
      'window.updated_at',
      'window.profile_id',
      'window.opened_at',
      'window.ua',
      'window.status',
      'group.name as group_name',
      'proxy.ip',
      'proxy.proxy',
      'proxy.proxy_type',
      'proxy.ip_country',
      'proxy.ip_checker',
    )
    .leftJoin('group', 'window.group_id', '=', 'group.id')
    .leftJoin('proxy', 'window.proxy_id', '=', 'proxy.id')
    .where('window.status', '>', 1)
    .orderBy('window.created_at', 'desc');
};

const getById = async (id: number) => {
  // 获取 window 记录及其关联数据
  const windowData = await db('window')
    .select(
      'window.*',
      'group.name as group_name',
      'proxy.ip',
      'proxy.proxy',
      'proxy.proxy_type',
      'proxy.ip_country',
      'proxy.ip_checker',
    )
    .where('window.id', '=', id)
    .leftJoin('group', 'window.group_id', '=', 'group.id')
    .leftJoin('proxy', 'window.proxy_id', '=', 'proxy.id')
    .first();

  if (windowData.tags) {
    // 分割 tags 字符串
    const tagIds = windowData.tags.toString().split(',').map(Number);

    // 获取所有相关的标签名称
    const tags = await db('tag').select('name').whereIn('id', tagIds);

    // 将标签名称添加到返回结果中
    windowData.tags_name = tags.map(tag => tag.name);
  }

  return windowData;
};

const update = async (id: number, updatedData: DB.Window) => {
  delete updatedData.group_name;
  delete updatedData.proxy;
  delete updatedData.proxy_type;
  delete updatedData.ip_country;
  delete updatedData.ip_checker;
  delete updatedData.ip;
  delete updatedData.tags_name;
  try {
    await db('window')
      .where({id})
      .update({...updatedData, updated_at: db.fn.now()});
    return {
      success: true,
      message: 'Window updated successfully.',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to update window.' + error,
    };
  }
};

const create = async (windowData: DB.Window, fingerprint: SafeAny) => {
  const {windowsUsed, windowsLimit} = dataStore.get('membership') as {
    windowsUsed: number;
    windowsLimit: number;
  };
  if (windowsUsed >= windowsLimit) {
    return {
      success: false,
      message: 'You have reached the maximum number of windows allowed by your membership plan.',
    };
  }
  if (windowData.id && typeof windowData.id === 'string') {
    windowData.profile_id = windowData.id;
    delete windowData.id;
  }
  if (!windowData.profile_id) {
    windowData.profile_id = generateUniqueProfileId();
  }
  windowData.ua = fingerprint.ua;
  const [id] = await db('window').insert(windowData);
  try {
    const {data} = await api.post('/power-api/fingerprints/window', {
      fingerprint: fingerprint || {},
      window_id: id,
      profile_id: windowData.profile_id,
    });
    if (data) {
      return {
        success: true,
        message: 'Window created successfully.',
        data: {
          ...windowData,
          id,
        },
      };
    } else {
      await db('window').where({id}).delete();
      return {
        success: false,
        message: 'Failed to create window.',
      };
    }
  } catch (error) {
    await db('window').where({id}).delete();
    return {
      success: false,
      message: 'Failed to create window.',
    };
  }
};

const remove = async (id: number) => {
  return await db('window').update({status: 0}).where({id});
};

const deleteAll = async () => {
  return await db('window').delete();
};

const batchRemove = async (ids: number[]) => {
  try {
    await api.delete('/power-api/fingerprints/window', {
      data: {
        window_ids: ids,
      },
    });
    await db('window').update({status: 0}).whereIn('id', ids);
    return {
      success: true,
      message: 'Windows deleted successfully.',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to delete window.',
    };
  }
};
const batchClear = async (ids: number[]) => {
  try {
    const {data} = await api.delete('/power-api/fingerprints/window', {
      data: {
        window_ids: ids,
      },
    });
    if (data.success) {
      await db('window').delete().whereIn('id', ids);
      return {
        success: true,
        message: 'Windows deleted successfully.',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to delete window.',
    };
  }
};

const externalImport = async (fileData: IWindowTemplate[]) => {
  const newWindowAdded = [];
  for (let index = 0; index < fileData.length; index++) {
    const row: IWindowTemplate = fileData[index];
    let newProxyId;
    let newGroupId;
    if (row.proxyid) {
      const proxy = {
        proxy_type: row.proxytype,
        proxy: row.proxy,
        ip: row.ip,
        ip_checker: row.ipchecker,
      } as DB.Proxy;
      const existProxy = await ProxyDB.getByProxy(proxy.proxy_type, proxy.proxy);
      if (existProxy) {
        newProxyId = existProxy.id;
      } else {
        const [id] = await ProxyDB.create(proxy);
        newProxyId = id;
      }
    }
    if (row.group) {
      const group = {
        name: row.group,
      };
      const existGroup = await GroupDB.getByName(row.group);
      if (existGroup) {
        newGroupId = existGroup.id;
      } else {
        const [id] = await GroupDB.create(group);
        newGroupId = id;
      }
    }
    const window: DB.Window = {
      name: row.name,
      group_id: newGroupId,
      profile_id: row.id as string,
      proxy_id: newProxyId,
      ua: row.ua,
      remark: row.remark,
      cookie: row.cookie,
    };
    const {data: fingerprint} = await api.get('/power-api/fingerprints/window');
    const result = await WindowDB.create(window, fingerprint);
    if (result.data?.id) {
      newWindowAdded.push(result.data?.id);
    }
  }
  return {
    success: newWindowAdded.length > 0,
    message: `${newWindowAdded.length} windows imported successfully.`,
    data: newWindowAdded,
  };
};

export const WindowDB = {
  all,
  getById,
  getOpenedWindows,
  update,
  create,
  remove,
  deleteAll,
  batchRemove,
  batchClear,
  externalImport,
};
