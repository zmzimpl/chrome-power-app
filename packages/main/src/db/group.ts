import {db} from '.';
import type {DB} from '../../../shared/types/db';

const all = async () => {
  return await db('group').select('*');
};

const getById = async (id: number) => {
  return await db('group').where({id}).first();
};
const getByName = async (name: string) => {
  return await db('group').where({name}).first();
};

const update = async (id: number, updatedData: DB.Group) => {
  return await db('group').where({id}).update(updatedData);
};

const create = async (groupData: DB.Group) => {
  return await db('group').insert(groupData);
};

const remove = async (id: number) => {
  return await db('group').where({id}).delete();
};

const deleteAll = async () => {
  return await db('group').delete();
};

export const GroupDB = {
  all,
  getById,
  getByName,
  update,
  create,
  remove,
  deleteAll,
};
