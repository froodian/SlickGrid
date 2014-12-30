/***
 * This plugin has been modified to support some SIGNIFICANT BEHAVIORAL DIFFERENCES from the original example
 * at http://mleibman.github.io/SlickGrid/examples/example-checkbox-row-select.html
 *
 *   * Clicking an unchecked header causes only the visible rows (instead of all rows) to be selected.  This is
 *       to support remotemodel, where we don't have all rows at all times.
 *   * When some rows are selected, the checkbox will appear indeterminate (like [-]).  When all visible rows are
 *       selected, the underlying checkbox will be checked (so that clicking it will uncheck all rows), and when some
 *       of the visible rows are selected, the underlying checkbox will be unchecked (so that clicking it will cause all
 *       formerly selected rows and all visible rows to be selected).
 *   * This plugin no longer automatically re-renders the grid when selected rows change.  Subscribe to
 *       onSelectedRowsChanged and render manually if you want.  See "Ian commented out this line" for more details.
 *   * Changed header selection/deselection to not invalidate each row, but to simply mark each row selected/deselected
 *       and to manually set the state on that row's checkbox.  This prevents the entire row from needing to rerender.
 *   * Made entire checkbox cell clickable
 *   * Support programmatic calling of setSelectedRows on the grid
 */
(function ($) {
  // register namespace
  $.extend(true, window, {
    "Slick": {
      "CheckboxSelectColumn": CheckboxSelectColumn
    }
  });


  function CheckboxSelectColumn(options) {
    var _grid;
    var _$headerCell = null;
    var _self = this;
    var _handler = new Slick.EventHandler();
    var _selectedRowsLookup = {};
    var _defaults = {
      columnId: "_checkbox_selector",
      cssClass: null,
      toolTip: "Select/Deselect All",
      width: 30
    };

    var _options = $.extend(true, {}, _defaults, options);

    function init(grid) {
      _grid = grid;
      _handler
        .subscribe(_grid.onSelectedRowsChanged, handleSelectedRowsChanged)
        .subscribe(_grid.onClick, handleClick)
        .subscribe(_grid.onHeaderClick, handleHeaderClick)
        .subscribe(_grid.onHeaderCellRendered, handleHeaderCellRendered)
        .subscribe(_grid.onViewportChanged, handleViewportChanged)
        .subscribe(_grid.onKeyDown, handleKeyDown);
      _$headerCell = null;
    }

    function destroy() {
      _handler.unsubscribeAll();
    }

    function handleSelectedRowsChanged(e, args) {
      var selectedRows = _grid.getSelectedRows();
      var lookup = {}, row, i;
      for (i = 0; i < selectedRows.length; i++) {
        row = selectedRows[i];
        lookup[row] = true;
        if (lookup[row] !== _selectedRowsLookup[row]) {
          delete _selectedRowsLookup[row];
        }
      }
      _selectedRowsLookup = lookup;
      applyFunctionToVisibleRows(function(i) {
        // Find this row's checkbox and set its state depending on whether it should be selected or not
        setRowCheckbox(i, _grid.getColumnIndex(_options.columnId), !!_selectedRowsLookup[i]);
      });
      setHeaderCellState();
    }

    function handleViewportChanged(e, args) {
      applyFunctionToVisibleRows(function(i) {
        // Find this row's checkbox and set its state depending on whether it should be selected or not
        setRowCheckbox(i, _grid.getColumnIndex(_options.columnId), !!_selectedRowsLookup[i]);
      });
      setHeaderCellState();
    }

    function setHeaderCellState() {
      if (_$headerCell != null) {
        // Ian commented out this line, because the grid subscriptions should handle rerendering as necessary when
        // rows have been invalidated.  In a remotemodel grid, this render call would cause all data to disappear
        // until it had been reloaded.
        //_grid.render();

        var viewport = _grid.getViewport();
        var allVisibleRowsAreChecked = true;
        for (var i = viewport.top; i < Math.min(viewport.bottom, _grid.getDataLength()); i++) {
          if (_selectedRowsLookup[i] == null || !_selectedRowsLookup[i]) {
            allVisibleRowsAreChecked = false;
          }
        }

        var selectedRows = _grid.getSelectedRows();
        var someRowsAreSelected = selectedRows.length && selectedRows.length > 0;

        // We want the header to be checked if all visible rows are selected
        _$headerCell.prop('checked', someRowsAreSelected && allVisibleRowsAreChecked);

        // We want the header to be indeterminate if only some rows are selected
        _$headerCell.prop("indeterminate", someRowsAreSelected && selectedRows.length < _grid.getDataLength());
      }
    }

    function handleKeyDown(e, args) {
      if (e.which == 32) {
        if (_grid.getColumns()[args.cell].id === _options.columnId) {
          // if editing, try to commit
          if (!_grid.getEditorLock().isActive() || _grid.getEditorLock().commitCurrentEdit()) {
            toggleRowSelection(args.row);
          }
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }
    }

    function handleClick(e, args) {
      // clicking on a row select checkbox
      if (_grid.getColumns()[args.cell].id === _options.columnId) {
        // if editing, try to commit
        if (_grid.getEditorLock().isActive() && !_grid.getEditorLock().commitCurrentEdit()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }

        toggleRowSelection(args.row, args.cell);
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }

    function toggleRowSelection(row, cell) {
      var alreadySelected = !!_selectedRowsLookup[row];

      setRowCheckbox(row, cell, !alreadySelected);

      if (alreadySelected) {
        _grid.setSelectedRows($.grep(_grid.getSelectedRows(), function (n) {
          return n != row
        }));
      } else {
        _grid.setSelectedRows(_grid.getSelectedRows().concat(row));
      }
    }

    function handleHeaderClick(e, args) {
      if (args.column.id == _options.columnId && $(e.target).is(":checkbox")) {
        // if editing, try to commit
        if (_grid.getEditorLock().isActive() && !_grid.getEditorLock().commitCurrentEdit()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }

        var selecting = $(e.target).is(":checked");
        var rowsToSelect = _grid.getSelectedRows();
        applyFunctionToVisibleRows(function(i) {rowsToSelect.push(i);});

        if (selecting) {
          _grid.setSelectedRows(rowsToSelect);
        } else {
          _grid.setSelectedRows([]);
        }
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }

    // Applies the given function to each visible row.
    // *func (Function) - Takes the row index
    function applyFunctionToVisibleRows(func) {
      var viewport = _grid.getViewport();
      // To support use with slick.remotemodel, only operate on rows which are visible in the viewport and for which
      // we actually have data
      for (var i = viewport.top; i < Math.min(viewport.bottom, _grid.getDataLength()); i++) {
        var dataItem = _grid.getDataItem(i);
        if (dataItem != null) {
          func(i);
        }
      }
    }

    function setRowCheckbox(row, cell, checked) {
      $(_grid.getCellNode(row, cell)).find("input[type=checkbox]").prop("checked", checked);
    }

    function handleHeaderCellRendered(e, args) {
      if (args.column.id == _options.columnId) {
        _$headerCell = $(args.node).find("input[type=checkbox]");
      }
    }

    function getColumnDefinition() {
      return {
        id: _options.columnId,
        name: "<input type='checkbox'>",
        toolTip: _options.toolTip,
        field: "sel",
        width: _options.width,
        resizable: false,
        sortable: false,
        cssClass: _options.cssClass,
        formatter: checkboxSelectionFormatter
      };
    }

    function checkboxSelectionFormatter(row, cell, value, columnDef, dataContext) {
      if (dataContext) {
        return _selectedRowsLookup[row]
            ? "<input type='checkbox' checked='checked'>"
            : "<input type='checkbox'>";
      }
      return null;
    }

    $.extend(this, {
      "init": init,
      "destroy": destroy,

      "getColumnDefinition": getColumnDefinition
    });
  }
})(jQuery);
