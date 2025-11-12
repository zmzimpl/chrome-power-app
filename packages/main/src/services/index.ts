import {initCommonService} from './common-service';
import {initGroupService} from './group-service';
import {initProxyService} from './proxy-service';
import {initSyncService} from './sync-service';
import {initTagService} from './tag-service';
import {initWindowService} from './window-service';
import {initExtensionService} from './extension-service';
import {initMultiWindowSyncService} from './multi-window-sync-service';

export async function initServices() {
  initCommonService();
  initWindowService();
  initGroupService();
  initProxyService();
  initTagService();
  initSyncService();
  initExtensionService();
  initMultiWindowSyncService();
}
