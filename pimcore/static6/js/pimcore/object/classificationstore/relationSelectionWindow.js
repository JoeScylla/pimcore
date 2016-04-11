/**
 * Pimcore
 *
 * This source file is available under two different licenses:
 * - GNU General Public License version 3 (GPLv3)
 * - Pimcore Enterprise License (PEL)
 * Full copyright and license information is available in 
 * LICENSE.md which is distributed with this source code.
 *
 * @copyright  Copyright (c) 2009-2016 pimcore GmbH (http://www.pimcore.org)
 * @license    http://www.pimcore.org/license     GPLv3 and PEL
 */

pimcore.registerNS("pimcore.object.classificationstore.relationSelectionWindow");
pimcore.object.classificationstore.relationSelectionWindow = Class.create({

    acceptEvents: true,

    initialize: function (parent, storeId) {
        this.parent = parent;
        this.storeId = storeId;
    },


    show: function() {
        this.searchfield = new Ext.form.TextField({
            width: 300,
            style: "float: left;",
            fieldLabel: t("search")
        });

        var resultPanel = this.getResultPanel();

        this.searchWindow = new Ext.Window({
            title: t('search_for_key'),
            width: 850,
            height: 550,
            modal: true,
            layout: "fit",
            items: [resultPanel],
            listeners: {
                beforeclose: function() {
                    this.parent.handleSelectionWindowClosed.call(this.parent);
                }.bind(this)
            },
            bbar: [//this.searchfield,
                "->",{
                    xtype: "button",
                    text: t("cancel"),
                    iconCls: "pimcore_icon_cancel",
                    handler: function () {
                        this.searchWindow.close();
                    }.bind(this)
                },{
                    xtype: "button",
                    text: t("apply"),
                    iconCls: "pimcore_icon_apply",
                    handler: function () {
                        var selectionModel = this.gridPanel.getSelectionModel();
                        var keyIds = [];
                        var selectedKeys = selectionModel.getSelection();
                        for (var ki = 0; ki < selectedKeys.length; ki++) {
                            var keyId = selectedKeys[ki].data.keyId;
                            var groupId = selectedKeys[ki].data.groupId;
                            keyIds.push({
                                keyId: keyId,
                                groupId: groupId
                            });
                        }
                        this.addRelations(keyIds);


                    }.bind(this)
                }]
        });

        this.searchWindow.show();
    },



    addRelations: function(keyIds) {
        if (!this.acceptEvents) {
            return;
        }
        this.acceptEvents = false;
        if (keyIds.length > 0) {
            this.parent.requestPending.call(this.parent);
            Ext.Ajax.request({
                url: "/admin/classificationstore/relations",
                params: {
                    relationIds: Ext.util.JSON.encode(keyIds)
                },
                success: function(response) {
                    this.parent.handleAddKeys.call(this.parent, response);
                    this.searchWindow.close();
                }.bind(this),
                failure: function(response) {
                    this.searchWindow.close();
                }.bind(this)
            });
        } else {
            this.searchWindow.close();
        }
    },

    getToolbar: function () {

        var user = pimcore.globalmanager.get("user");
        var toolbar;
        var items = [];


        var keyButton  = new Ext.Button({
            text: t("key"),
            handler: this.searchKey.bind(this),
            iconCls: "pimcore_icon_key",
            enableToggle: true,
            pressed: !this.isGroupSearch && !this.isCollectionSearch,
            hidden: !this.enableKeys
        });
        items.push(keyButton);

        items.push("->");
        items.push(this.searchfield);

        items.push({
            xtype: "button",
            text: t("search"),
            iconCls: "pimcore_icon_search",
            handler: function () {
                var formValue = this.searchfield.getValue();

                this.store.getProxy().setExtraParam("searchfilter", formValue);


                var lastOptions = this.store.lastOptions;
                Ext.apply(lastOptions.params, {
                    filter: this.encodedFilter
                });
                this.store.reload();

                this.gridPanel.getView().refresh();
            }.bind(this)
        });

        if(items.length > 1) {
            toolbar = {
                items: items
            };
        }

        return toolbar;
    },

    resetToolbarButtons: function () {
        if(this.toolbarbuttons.collection) {
            this.toolbarbuttons.collection.toggle(false);
        }

        if(this.toolbarbuttons.group) {
            this.toolbarbuttons.group.toggle(false);
        }
        if(this.toolbarbuttons.key) {
            this.toolbarbuttons.key.toggle(false);
        }
    },


    searchKey: function () {
        this.resetToolbarButtons();
        this.toolbarbuttons.key.toggle(true);
        this.isGroupSearch = false;
        this.isCollectionSearch = false;
        this.getGridPanel();
    },

    getResultPanel: function () {
        this.resultPanel = new Ext.Panel({
            tbar: this.getToolbar(),
            layout: "fit",
            style: {
                backgroundColor: "#0000FF"
            }
        });

        this.getGridPanel();
        return this.resultPanel;
    },

    getData: function () {
        var selected = this.groupGridPanel.getSelectionModel().getSelections();
        if(selected) {
            return selected.data.id;
        }
        return null;
    },

    getGridPanel: function() {
        this.groupFields = ['id', 'groupName', 'keyName', 'keyDescription', 'keyId', 'groupId'];

        var readerFields = [];
        for (var i = 0; i < this.groupFields.length; i++) {
            readerFields.push({name: this.groupFields[i], allowBlank: true});
        }


        var gridColumns = [];
        gridColumns.push({header: "ID", width: 40, sortable: true, dataIndex: 'id'});
        gridColumns.push({header: t("group"), flex: 1, sortable: true, dataIndex: 'groupName'});
        gridColumns.push({header: t("name"), flex: 1, sortable: true, dataIndex: 'keyName'});
        gridColumns.push({header: t("description"), flex: 1, sortable: true, dataIndex: 'keyDescription'});


        var proxy = {
            type: 'ajax',
            url: "/admin/classificationstore/search-relations",
            reader: {
                type: 'json',
                rootProperty: 'data',
            },
            extraParams: {
                storeId: this.storeId
            }
        };

        if (this.object) {
            proxy.extraParams.oid = this.object.id;
            proxy.extraParams.fieldname = this.fieldname;
        }

        this.store = new Ext.data.Store({
            remoteSort: true,
            proxy: proxy,
            fields: readerFields
        });


        var emptyMsg = "classificationstore_no_keys";


        this.pagingtoolbar = new Ext.PagingToolbar({
            pageSize: 15,
            store: this.store,
            displayInfo: true,
            displayMsg: '{0} - {1} / {2}',
            emptyMsg: t(emptyMsg)
        });


        this.gridPanel = new Ext.grid.GridPanel({
            store: this.store,
            border: false,
            columns: gridColumns,
            loadMask: true,
            columnLines: true,
            bodyCls: "pimcore_editable_grid",
            stripeRows: true,
            selModel: Ext.create('Ext.selection.RowModel', {
                mode: 'MULTI'
            }),
            bbar: this.pagingtoolbar,
            listeners: {
                rowdblclick: function (grid, record, tr, rowIndex, e, eOpts ) {
                    var record = grid.getStore().getAt(rowIndex);
                    var keyId = record.data.keyId;
                    var groupId = record.data.groupId;
                    this.addRelations([{
                        keyId: keyId,
                        groupId: groupId
                    }]);
                    this.searchWindow.close();
                }.bind(this)
            },
            viewConfig: {
                forcefit: true
            }
        });

        this.store.load();

        this.resultPanel.removeAll();
        this.resultPanel.add(this.gridPanel);
        this.resultPanel.updateLayout();
    }

});