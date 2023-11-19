import {ipcRenderer} from 'electron';
import type {DB} from '../../../shared/types/db';

export const GroupBridge = {
  async getAll() {
    const result = await ipcRenderer.invoke('group-getAll');
    return result;
  },
  async create(group: DB.Group) {
    const result = await ipcRenderer.invoke('group-create', group);
    return result;
  },

  async update(group: DB.Group) {
    const result = await ipcRenderer.invoke('group-update', group);
    return result;
  },
  async delete(id: number) {
    const result = await ipcRenderer.invoke('group-delete', id);
    return result;
  },
};
