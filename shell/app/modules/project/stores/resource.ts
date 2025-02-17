// Copyright (c) 2021 Terminus, Inc.
//
// This program is free software: you can use, redistribute, and/or modify
// it under the terms of the GNU Affero General Public License, version 3
// or later ("AGPL"), as published by the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

import { get, map } from 'lodash';
import * as ResourceServices from '../services/resource';
import userStore from 'app/user/stores';
import monitorCommonStore from 'common/stores/monitorCommon';
import i18n from 'i18n';
import { createStore } from 'app/cube';

const typeTitleMap = {
  cpu: 'CPU',
  memory: i18n.t('memory'),
};

interface Istate {
  serviceList: RESOURCE.Instances[] | RESOURCE.ServiceItem[];
  chartList: Array<{
    loading: boolean;
    results: RESOURCE.MetaData[],
    time: number[];
    title: string;
  }>
}

const projectResource = createStore({
  name: 'projectResource',
  state: {
    chartList: [],
    serviceList: [],
  } as Istate,
  effects: {
    async getServiceList({ call, update }, payload: Omit<RESOURCE.QueryServiceList, 'org'>) {
      const { orgId } = userStore.getState(s => s.loginUser);
      const serviceList = await call(ResourceServices.getServiceList, { ...payload, org: orgId });
      await update({ serviceList });
    },
    async getChartData({ call, getParams }, payload: Omit<RESOURCE.QuertChart, 'projectId' | 'query'>) {
      const { type } = payload;
      const { projectId } = getParams();
      const { startTimeMs, endTimeMs } = monitorCommonStore.getState(s => s.timeSpan);
      const query = { start: startTimeMs, end: endTimeMs };
      const data = await call(ResourceServices.getChartData, { type, projectId, ...payload, query });
      projectResource.reducers.getChartDataSuccess({ data, type });
    },
  },
  reducers: {
    getChartDataSuccess(state, payload: { data: RESOURCE.CharData, type: string }) {
      const { type, data: listData } = payload;
      const { chartList } = state;
      // 去掉cpu内存统计图数据
      if (type === 'cpu') {
        return;
      }
      // const idx = type === 'cpu' ? 0 : 1;
      const { time, results } = listData || {};
      const curList = get(results, '[0].data') || [];
      const dataKeys = { cpu: 'last.cpu_usage_percent', memory: 'last.mem_usage' };
      const reData: RESOURCE.MetaData[] = map(curList, (listItem) => {
        const { data, tag, name, ...restData } = listItem[dataKeys[type]] || {};
        return { ...restData, name: tag || name, data };
      });

      chartList[0] = {
        loading: false,
        time,
        results: reData,
        title: typeTitleMap[type],
      };
    },
    clearChartList(state) {
      state.chartList = [];
    },
    clearServiceList(state) {
      state.serviceList = [];
    },
  },
});

export default projectResource;
