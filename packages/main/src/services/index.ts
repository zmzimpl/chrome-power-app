import {initCommonService} from './commonService';
import {initGroupService} from './groupService';
import {initProxyService} from './proxyService';
import {initSyncService} from './syncService';
import {initTagService} from './tagService';
import {initWindowService} from './windowService';

export async function initServices() {
  initCommonService();
  initWindowService();
  initGroupService();
  initProxyService();
  initTagService();
  initSyncService();
}
