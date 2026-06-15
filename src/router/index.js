import { createRouter, createWebHashHistory } from "vue-router";
import IntroPage from "../views/IntroPage.vue";
import DataCollectionPage from "../views/DataCollectionPage.vue";
import ClosingQueuePage from "../views/ClosingQueuePage.vue";
import DataTablePage from "../views/DataTablePage.vue";
import ExcelReportPage from "../views/ExcelReportPage.vue";

const routes = [
  {
    path: "/",
    name: "intro",
    component: IntroPage,
  },
  {
    path: "/closing-queue",
    name: "closing-queue",
    component: ClosingQueuePage,
  },
  {
    path: "/data-collection",
    redirect: "/collect/upload-validation",
  },
  {
    path: "/collect/upload-validation",
    name: "upload-validation",
    component: DataCollectionPage,
  },
  {
    path: "/collect/data-table",
    name: "data-table",
    component: DataTablePage,
  },
  {
    path: "/excel-report",
    name: "excel-report",
    component: ExcelReportPage,
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
