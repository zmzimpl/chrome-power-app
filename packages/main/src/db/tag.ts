import {db} from '.';
import type {DB} from '../../../shared/types/db';

const all = async () => {
  return await db('tag').select('*');
};

const getById = async (id: number) => {
  return await db('tag').where({id}).first();
};
const getByName = async (name: string) => {
  return await db('tag').where({name}).first();
};

const update = async (id: number, updatedData: DB.Tag) => {
  return await db('tag').where({id}).update(updatedData);
};

const create = async (tagData: DB.Tag) => {
  return await db('tag').insert(tagData);
};

const remove = async (id: number) => {
  return await db('tag').where({id}).delete();
};

const deleteAll = async () => {
  return await db('tag').delete();
};

export const TagDB = {
  all,
  getById,
  getByName,
  update,
  create,
  remove,
  deleteAll,
};
