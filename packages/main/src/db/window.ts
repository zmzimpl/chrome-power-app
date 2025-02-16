import {db} from '.';
import type {DB, SafeAny} from '../../../shared/types/db';
import type {IWindowTemplate} from '../types/window-template';
import {GroupDB} from './group';
import {randomUniqueProfileId} from '../../../shared/utils/random';

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
      'window.fingerprint',
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

const find = async (params: DB.Window) => {
  return await db('window').where(params);
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
  if (updatedData.group_id === undefined) {
    updatedData.group_id = null;
  }
  if (updatedData.tags === undefined) {
    updatedData.tags = null;
  }
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

const create = async (windowData: DB.Window, fingerprint?: SafeAny) => {
  if (windowData.id && typeof windowData.id === 'string') {
    windowData.profile_id = windowData.id;
    delete windowData.id;
  }
  if (!windowData.profile_id) {
    windowData.profile_id = randomUniqueProfileId();
    // 确保 profile_id 是唯一的
    while (await db('window').where({profile_id: windowData.profile_id}).first()) {
      windowData.profile_id = randomUniqueProfileId();
    }
  }
  if (fingerprint) {
    windowData.ua = fingerprint.ua;
    windowData.fingerprint = JSON.stringify(fingerprint);
  }
  // else {
  //   const randFingerprint = randomFingerprint();
  //   windowData.ua = randFingerprint.ua;
  //   windowData.fingerprint = JSON.stringify(randFingerprint);
  // }
  const [id] = await db('window').insert(windowData);
  return {
    success: true,
    message: 'Window created successfully.',
    data: {
      ...windowData,
      id,
    },
  };
};

const remove = async (id: number) => {
  return await db('window').update({status: 0}).where({id});
};

const deleteAll = async () => {
  return await db('window').delete();
};

const batchRemove = async (ids: number[]) => {
  try {
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
    await db('window').delete().whereIn('id', ids);
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

const externalImport = async (fileData: IWindowTemplate[]) => {
  const newWindowAdded = [];
  for (let index = 0; index < fileData.length; index++) {
    const row: IWindowTemplate = fileData[index];
    let newGroupId;
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
      proxy_id: row.proxyid ? Number(row.proxyid) : null,
      ua: row.ua,
      remark: row.remark,
      cookie: row.cookie,
    };
    // const fingerprint = randomFingerprint();
    const result = await WindowDB.create(window, {});
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
  find,
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
