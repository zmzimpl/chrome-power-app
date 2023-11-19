import {db} from '.';
import type {DB} from '../../../shared/types/db';

const all = async () => {
  return await db('proxy').select('*');
};

const getById = async (id: number) => {
  return await db('proxy').where({id}).first();
};

const getByProxy = async (proxy_type?: string, proxy?: string) => {
  return await db('proxy').where({proxy_type, proxy}).first();
};

const update = async (id: number, updatedData: DB.Proxy) => {
  return await db('proxy').where({id}).update(updatedData);
};

const create = async (proxyData: DB.Proxy) => {
  return await db('proxy').insert(proxyData);
};

const importProxies = async (proxies: DB.Proxy[]) => {
  return await db('proxy').insert(proxies);
};

const remove = async (id: number) => {
  return await db('proxy').where({id}).delete();
};

const deleteAll = async () => {
  return await db('proxy').delete();
};

const batchDelete = async (ids: number[]) => {
  // 首先，检查这些 IDs 是否被 window 表所引用
  const referencedIds = await db('window')
    .select('proxy_id')
    .whereIn('proxy_id', ids)
    .then(rows => rows.map(row => row.proxy_id));

  // 如果有被引用的 ID，可以选择抛出错误或者返回相关信息
  if (referencedIds.length > 0) {
    // 或者返回相关信息
    return {success: false, message: 'Some IDs are referenced in the window table.', referencedIds};
  } else {
    try {
      await db('proxy').delete().whereIn('id', ids);
      return {success: true};
    } catch (error) {
      return {success: false, message: 'Failed to delete.'};
    }
  }
};

export const ProxyDB = {
  all,
  getById,
  getByProxy,
  batchDelete,
  importProxies,
  update,
  create,
  remove,
  deleteAll,
};
