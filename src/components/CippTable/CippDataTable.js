import { MaterialReactTable, useMaterialReactTable } from "material-react-table";
import {
  Card,
  CardContent,
  CardHeader,
  Divider,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Skeleton,
  SvgIcon,
} from "@mui/material";
import { ResourceUnavailable } from "../resource-unavailable";
import { ResourceError } from "../resource-error";
import { Scrollbar } from "../scrollbar";
import React, { useEffect, useMemo, useState } from "react";
import { ApiGetCallWithPagination } from "../../api/ApiCall";
import { utilTableMode } from "./util-tablemode";
import { utilColumnsFromAPI } from "./util-columnsFromAPI";
import { CIPPTableToptoolbar } from "./CIPPTableToptoolbar";
import { More, MoreHoriz } from "@mui/icons-material";
import { CippOffCanvas } from "../CippComponents/CippOffCanvas";
import { useDialog } from "../../hooks/use-dialog";
import { CippApiDialog } from "../CippComponents/CippApiDialog";
import { getCippError } from "../../utils/get-cipp-error";

export const CippDataTable = (props) => {
  const {
    queryKey,
    data = [],
    columns = [],
    api = {},
    isFetching = false,
    columnVisibility: initialColumnVisibility = {
      id: false,
      RowKey: false,
      ETag: false,
      PartitionKey: false,
      Timestamp: false,
      TableTimestamp: false,
    },
    exportEnabled = true,
    simpleColumns = [],
    actions,
    title = "Report",
    simple = false,
    cardButton,
    offCanvas = false,
    noCard = false,
    refreshFunction,
    incorrectDataMessage = "Data not in correct format",
  } = props;
  const [columnVisibility, setColumnVisibility] = useState(initialColumnVisibility);
  const [usedData, setUsedData] = useState(data);
  const [usedColumns, setUsedColumns] = useState([]);
  const [offcanvasVisible, setOffcanvasVisible] = useState(false);
  const [offCanvasData, setOffCanvasData] = useState({});
  const [actionData, setActionData] = useState({ data: {}, action: {}, ready: false });
  const waitingBool = api?.url ? true : false;
  const getRequestData = ApiGetCallWithPagination({
    url: api.url,
    data: { ...api.data },
    queryKey: queryKey ? queryKey : title,
    waiting: waitingBool,
  });
  useEffect(() => {
    if (data) {
      if (JSON.stringify(data) !== JSON.stringify(usedData) && data.length > 0) {
        setUsedData(data);
      }
    }
  }, [data, queryKey, JSON.stringify(data)]);
  useEffect(() => {
    if (getRequestData.isSuccess && !getRequestData.isFetching) {
      const lastPage = getRequestData.data?.pages[getRequestData.data.pages.length - 1];
      const nextLinkExists = lastPage?.Metadata?.nextLink;
      if (nextLinkExists) {
        getRequestData.fetchNextPage();
      }
    }
  }, [getRequestData.data?.pages?.length, getRequestData.isFetching, queryKey]);

  useEffect(() => {
    if (getRequestData.isSuccess) {
      const allPages = getRequestData.data.pages;
      const getNestedValue = (obj, path) => {
        // If path is undefined or empty, return the root object itself
        if (!path) {
          return obj;
        }

        const keys = path.split(".");
        let result = obj;
        for (const key of keys) {
          if (result && typeof result === "object" && key in result) {
            result = result[key];
          } else {
            return undefined;
          }
        }
        return result;
      };

      const combinedResults = allPages.flatMap((page) => {
        const nestedData = getNestedValue(page, api.dataKey);
        return nestedData !== undefined ? nestedData : [];
      });

      setUsedData(combinedResults || []);
    }
  }, [
    getRequestData.isSuccess,
    getRequestData.data,
    api.dataKey,
    getRequestData.isFetching,
    queryKey,
  ]);

  useEffect(() => {
    if (!Array.isArray(usedData) || usedData.length === 0 || typeof usedData[0] !== "object") {
      return;
    }
    const apiColumns = utilColumnsFromAPI(usedData);
    let finalColumns = [];
    let newVisibility = { ...columnVisibility };

    if (columns.length === 0 && simpleColumns.length === 0) {
      finalColumns = apiColumns;
      apiColumns.forEach((col) => {
        newVisibility[col.id] = true;
      });
    } else if (simpleColumns.length > 0) {
      finalColumns = apiColumns.map((col) => {
        newVisibility[col.id] = simpleColumns.includes(col.id);
        return col;
      });
    } else {
      const providedColumnKeys = new Set(columns.map((col) => col.id || col.header));
      finalColumns = [...columns, ...apiColumns.filter((col) => !providedColumnKeys.has(col.id))];
      finalColumns.forEach((col) => {
        newVisibility[col.accessorKey] = providedColumnKeys.has(col.id);
      });
    }
    setUsedColumns(finalColumns);
    setColumnVisibility(newVisibility);
  }, [columns.length, usedData.length, queryKey]);

  const createDialog = useDialog();

  // Apply the modeInfo directly
  const [modeInfo] = useState(
    utilTableMode(columnVisibility, simple, actions, simpleColumns, offCanvas)
  );

  //create memoized version of usedColumns, and usedData
  const memoizedColumns = useMemo(() => usedColumns, [usedColumns]);
  const memoizedData = useMemo(() => usedData, [usedData]);
  const useActionMenuItems = (actions, setActionData, createDialog, row, closeMenu) =>
    useMemo(
      () =>
        actions.map((action, index) => (
          <MenuItem
            sx={{ color: action.color }}
            key={`actions-list-row-${index}`}
            onClick={() => {
              console.log(row);
              setActionData({
                data: row.original,
                action: action,
                ready: true,
              });
              createDialog.handleOpen();
              closeMenu();
            }}
          >
            <SvgIcon fontSize="small" sx={{ minWidth: "30px" }}>
              {action.icon}
            </SvgIcon>
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        )),
      [actions, setActionData, row, closeMenu] // include row and closeMenu in dependencies
    );

  // Pass `row` to `useActionMenuItems` in `renderRowActionMenuItems`
  const renderRowActionMenuItems = ({
    closeMenu,
    row,
    offCanvas,
    setOffCanvasData,
    setOffcanvasVisible,
  }) => {
    const actionMenuItems = useActionMenuItems(
      actions,
      setActionData,
      createDialog,
      row,
      closeMenu
    );
    return [
      ...actionMenuItems,
      offCanvas && (
        <MenuItem
          key="actions-list-row-more"
          onClick={() => {
            closeMenu();
            setOffCanvasData(row.original);
            setOffcanvasVisible(true);
          }}
        >
          <SvgIcon fontSize="small" sx={{ minWidth: "30px" }}>
            <MoreHoriz />
          </SvgIcon>
          More Info
        </MenuItem>
      ),
    ];
  };
  const table = useMaterialReactTable({
    enableRowVirtualization: true,
    enableColumnVirtualization: true,
    mrtTheme: (theme) => ({
      baseBackgroundColor: theme.palette.background.paper,
    }),
    columns: memoizedColumns,
    data: memoizedData,
    state: { columnVisibility },
    renderEmptyRowsFallback: ({ table }) =>
      getRequestData.data?.pages?.[0].Metadata?.QueueMessage ? (
        <center>{getRequestData.data?.pages?.[0].Metadata?.QueueMessage}</center>
      ) : undefined,
    onColumnVisibilityChange: setColumnVisibility,
    ...modeInfo,

    renderRowActionMenuItems,
    renderTopToolbar: ({ table }) => {
      return (
        <>
          {!simple && (
            <CIPPTableToptoolbar
              table={table}
              columnVisibility={columnVisibility}
              getRequestData={getRequestData}
              usedColumns={usedColumns}
              title={title}
              actions={actions}
              exportEnabled={exportEnabled}
              refreshFunction={refreshFunction}
            />
          )}
        </>
      );
    },
  });

  return (
    <>
      {noCard ? (
        // Just render the table and related components without the Card
        <Scrollbar>
          {!Array.isArray(usedData) && usedData ? (
            <ResourceUnavailable message={incorrectDataMessage} />
          ) : (
            <>
              {(getRequestData.isSuccess || getRequestData.data?.pages.length >= 0 || data) && (
                <MaterialReactTable table={table} />
              )}
            </>
          )}
          {getRequestData.isError && !getRequestData.isFetchNextPageError && (
            <ResourceError
              onReload={() => getRequestData.refetch()}
              message={`Error Loading data:  ${getCippError(getRequestData.error)}`}
            />
          )}
          {isFetching || (getRequestData.isFetching && !getRequestData.data) ? (
            <>
              <Skeleton />
            </>
          ) : null}
        </Scrollbar>
      ) : (
        // Render the table inside a Card
        <Card style={{ width: "100%" }}>
          <CardHeader action={cardButton} title={title} />
          <Divider />
          <CardContent sx={{ padding: "1rem" }}>
            <Scrollbar>
              {!Array.isArray(usedData) && usedData ? (
                <ResourceUnavailable message={incorrectDataMessage} />
              ) : (
                <>
                  {(getRequestData.isSuccess || getRequestData.data?.pages.length >= 0 || data) && (
                    <MaterialReactTable
                      enableRowVirtualization
                      enableColumnVirtualization
                      table={table}
                    />
                  )}
                </>
              )}
              {getRequestData.isError && !getRequestData.isFetchNextPageError && (
                <ResourceError
                  onReload={() => getRequestData.refetch()}
                  message={`Error Loading data:  ${getCippError(getRequestData.error)}`}
                />
              )}
              {isFetching || (getRequestData.isFetching && !getRequestData.data) ? (
                <>
                  <Skeleton />
                </>
              ) : null}
            </Scrollbar>
          </CardContent>
        </Card>
      )}
      <CippOffCanvas
        isFetching={getRequestData.isFetching}
        visible={offcanvasVisible}
        onClose={() => setOffcanvasVisible(false)}
        extendedData={offCanvasData}
        extendedInfoFields={offCanvas?.extendedInfoFields}
        actions={actions}
        children={offCanvas?.children}
      />
      {actionData.ready && (
        <CippApiDialog
          createDialog={createDialog}
          title="Confirmation"
          fields={actionData.action?.fields}
          api={actionData.action}
          row={actionData.data}
          relatedQueryKeys={queryKey ? queryKey : title}
        />
      )}
    </>
  );
};
