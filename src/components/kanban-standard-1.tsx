"use client";

import * as React from "react";

import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from "@/components/kibo-ui/kanban";

export const title = "Basic kanban board";

const columns = [
  { id: "backlog", name: "Backlog" },
  { id: "progress", name: "In progress" },
  { id: "done", name: "Done" },
];

const Example = () => {
  const [data, setData] = React.useState([
    { id: "1", name: "Write brief", column: "backlog" },
    { id: "2", name: "Design mock", column: "progress" },
    { id: "3", name: "Ship docs", column: "done" },
    { id: "4", name: "QA pass", column: "progress" },
  ]);

  return (
    <div className="w-full overflow-x-auto">
      <KanbanProvider
        className="w-full max-w-4xl min-w-[36rem]"
        columns={columns}
        data={data}
        onDataChange={setData}
      >
        {(column) => (
          <KanbanBoard id={column.id} key={column.id}>
            <KanbanHeader>{column.name}</KanbanHeader>
            <KanbanCards id={column.id}>
              {(item) => <KanbanCard key={item.id} {...item} />}
            </KanbanCards>
          </KanbanBoard>
        )}
      </KanbanProvider>
    </div>
  );
};

export default Example;
