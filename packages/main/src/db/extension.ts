import {db} from '.';
import type {DB} from '../../../shared/types/db';

const getAllExtensions = async () => {
  return await db('extension').select('*');
};

const getExtensionById = async (id: number) => {
  return await db('extension').where({id}).first();
};

const createExtension = async (extension: DB.Extension) => {
  return await db('extension').insert(extension);
};

const updateExtension = async (id: number, extension: Partial<DB.Extension>) => {
  const extensionData = await getExtensionById(id);
  if (!extensionData) {
    throw new Error('Extension not found');
  }

  return await db('extension')
    .where({id})
    .update({
      ...extensionData,
      ...extension,
    });
};

const insertExtensionWindows = async (id: number, windows: number[]) => {
  for (const windowId of windows) {
    await db('window_extension').insert({extension_id: id, window_id: windowId});
  }
};

const getExtensionsByWindowId = async (windowId: number) => {
  const extensionIds = await db('window_extension')
    .where({window_id: windowId})
    .select('extension_id');
  return await db('extension').whereIn(
    'id',
    extensionIds.map(e => e.extension_id),
  );
};

const deleteExtensionWindows = async (id: number, windowIds: number[]) => {
  return await db('window_extension')
    .where({extension_id: id})
    .whereIn('window_id', windowIds)
    .delete();
};

const getExtensionWindows = async (id: number) => {
  return await db('window_extension').where({extension_id: id});
};

const deleteExtension = async (id: number) => {
  const relatedWindows = await getExtensionWindows(id);
  if (relatedWindows.length > 0) {
    return {
      success: false,
      message: 'Extension is still in use',
    };
  } else {
    return await db('extension').where({id}).delete();
  }
};

export const ExtensionDB = {
  getAllExtensions,
  getExtensionById,
  createExtension,
  updateExtension,
  deleteExtension,
  insertExtensionWindows,
  deleteExtensionWindows,
  getExtensionWindows,
  getExtensionsByWindowId,
};
