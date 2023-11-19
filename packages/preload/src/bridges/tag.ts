import {ipcRenderer} from 'electron';
import type {DB} from '../../../shared/types/db';

export const TagBridge = {
  async getAll() {
    const result = await ipcRenderer.invoke('tag-getAll');
    return result;
  },
  async create(tag: DB.Tag) {
    const result = await ipcRenderer.invoke('tag-create', tag);
    return result;
  },

  async update(tag: DB.Tag) {
    const result = await ipcRenderer.invoke('tag-update', tag);
    return result;
  },
  async delete(id: number) {
    const result = await ipcRenderer.invoke('tag-delete', id);
    return result;
  },
};
