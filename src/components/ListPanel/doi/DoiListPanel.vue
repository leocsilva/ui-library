<template>
	<div class="doiListPanel">
		<slot>
			<list-panel :items="mappedItems" :isSidebarVisible="true">
				<template slot="header">
					<pkp-header>
						<h2>{{ title }}</h2>
						<spinner v-if="isLoading" />
						<template slot="actions">
							<search
								:searchPhrase="searchPhrase"
								@search-phrase-changed="setSearchPhrase"
							/>

							<dropdown label="Bulk Actions" class="doiListPanel__bulkActions">
								<div class="pkpDropdown__section">
									<ul>
										<li>
											<button
												class="pkpDropdown__action"
												id="toggleSelectAll"
												@click="toggleSelectAll"
											>
												{{
													isAllSelected
														? __('common.selectNone')
														: __('common.selectAll')
												}}
											</button>
										</li>
										<li>
											<button
												class="pkpDropdown__action"
												id="toggleExpandAll"
												@click="toggleExpandAll"
											>
												{{
													isAllExpanded
														? __('list.collapseAll')
														: __('list.expandAll')
												}}
											</button>
										</li>
									</ul>
								</div>

								<div class="pkpDropdown__section">
									<div class="app__userNav__loggedInAs">
										Take action on {{ selected.length }} selected item(s)
									</div>
									<ul>
										<li v-if="isRegistrationPluginConfigured">
											<button
												class="pkpDropdown__action"
												id="openBulkExport"
												@click="openBulkExport"
											>
												Export
											</button>
										</li>

										<li>
											<button
												class="pkpDropdown__action"
												id="openBulkMarkRegistered"
												@click="openBulkMarkRegistered"
											>
												Mark registered
											</button>
										</li>

										<li>
											<button
												class="pkpDropdown__action"
												id="openBulkAssign"
												@click="openBulkAssign"
											>
												Assign DOIs
											</button>
										</li>

										<li v-if="isRegistrationPluginConfigured">
											<button
												class="pkpDropdown__action"
												@click="openBulkDeposit"
											>
												Deposit
											</button>
										</li>
									</ul>
								</div>
							</dropdown>

							<pkp-button
								:is-primary="true"
								v-if="isRegistrationPluginConfigured"
								id="openBulkDepositAll"
								@click="openBulkDepositAll"
							>
								{{ __('manager.dois.actions.deposit.all') }}
							</pkp-button>
						</template>
					</pkp-header>
				</template>

				<template slot="sidebar">
					<pkp-header :isOneLine="false">
						<h3>
							<icon icon="filter" :inline="true" />
							{{ __('common.filter') }}
						</h3>
					</pkp-header>
					<div
						v-for="(filterSet, index) in filters"
						:key="index"
						class="listPanel__block"
					>
						<pkp-header v-if="filterSet.heading">
							<h4>{{ filterSet.heading }}</h4>
						</pkp-header>
						<component
							v-for="filter in filterSet.filters"
							:key="filter.param + filter.value"
							:is="filter.filterType || 'pkp-filter'"
							v-bind="filter"
							:isFilterActive="isFilterActive(filter.param, filter.value)"
							@add-filter="addFilter"
							@remove-filter="removeFilter"
							@update-filter="addFilter"
						/>
					</div>
				</template>

				<template slot="itemsEmpty">
					<template v-if="isLoading">
						<spinner />
						{{ __('common.loading') }}
					</template>
					<template v-else>
						{{ __('common.noItemsFound') }}
					</template>
				</template>

				<template v-slot:item="{item}">
					<slot name="item" :item="item">
						<doi-list-item
							:key="item.id"
							:item="item"
							:api-url="apiUrl"
							:doi-api-url="doiApiUrl"
							:doi-prefix="doiPrefix"
							:is-selected="selected.includes(item.id)"
							:is-expanded="expanded.includes(item.id)"
							:enabled-doi-types="enabledDoiTypes"
							:registration-agency-info="registrationAgencyInfo"
							@select-item="selectItem"
							@expand-item="expandItem"
							@deposit-triggered="openBulkDeposit"
							@update-successful-doi-edits="updateSuccessfulDoiEdits"
						/>
					</slot>
				</template>

				<pagination
					v-if="lastPage > 1"
					slot="footer"
					:currentPage="currentPage"
					:isLoading="isLoading"
					:lastPage="lastPage"
					@set-page="setPage"
				/>
			</list-panel>
		</slot>
	</div>
</template>

<script>
import DoiListItem from '@/components/ListPanel/doi/DoiListItem';
import Dropdown from '@/components/Dropdown/Dropdown';
import FieldSelect from '@/components/Form/fields/FieldSelect';
import ListPanel from '@/components/ListPanel/ListPanel.vue';
import Pagination from '@/components/Pagination/Pagination.vue';
import PkpFilter from '@/components/Filter/Filter.vue';
import PkpFilterAutosuggest from '@/components/Filter/FilterAutosuggest.vue';
import PkpHeader from '@/components/Header/Header.vue';
import Search from '@/components/Search/Search.vue';
import fetch from '@/mixins/fetch';
import ajaxError from '@/mixins/ajaxError';

export default {
	components: {
		DoiListItem,
		Dropdown,
		FieldSelect,
		ListPanel,
		Pagination,
		PkpFilter,
		PkpFilterAutosuggest,
		PkpHeader,
		Search
	},
	mixins: [ajaxError, fetch],
	props: {
		id: {
			type: String,
			required: true
		},
		items: {
			type: Array,
			default() {
				return [];
			}
		},
		itemsMax: {
			type: Number,
			default() {
				return 0;
			}
		},
		itemType: {
			type: String,
			required: true
		},
		filters: {
			type: Array,
			default() {
				return {};
			}
		},
		title: {
			type: String,
			required: true
		},
		doiPrefix: {
			type: String,
			default() {
				return '';
			}
		},
		enabledDoiTypes: {
			type: Array,
			default() {
				return [];
			}
		},
		doiApiUrl: {
			type: String,
			required: true
		},
		executeActionApiUrl: {
			type: String,
			required: true
		},
		registrationAgencyInfo: {
			type: Object,
			required: true
		}
	},
	data() {
		return {
			activeFilters: {},
			selected: [],
			expanded: []
		};
	},
	methods: {
		/**
		 * Set the list of items
		 *
		 * @see @/mixins/fetch.js
		 * @param {Array} items
		 * @param {Number} itemsMax
		 */
		setItems(items, itemsMax) {
			this.$emit('set', this.id, {
				items,
				itemsMax
			});
		},
		/**
		 * Select a DoiListItem in the DoiListPanel
		 *
		 * @param {Number} itemId
		 */
		selectItem(itemId) {
			if (this.selected.includes(itemId)) {
				this.selected = this.selected.filter(item => item !== itemId);
			} else {
				this.selected.push(itemId);
			}
		},
		/**
		 * Expand a DoiListItem in the DoiListPanel
		 *
		 * @param {Number} itemId
		 */
		expandItem(itemId) {
			if (this.expanded.includes(itemId)) {
				this.expanded = this.expanded.filter(item => item !== itemId);
			} else {
				this.expanded.push(itemId);
			}
		},
		/**
		 * Toggles expand all for DOI tabs
		 */
		toggleExpandAll() {
			if (this.isAllExpanded) {
				this.expanded = [];
			} else {
				this.expanded = this.items.map(i => i.id);
			}
		},
		/**
		 * Toggle select all for Ids in selected
		 */
		toggleSelectAll() {
			if (this.isAllSelected) {
				this.selected = [];
			} else {
				this.selected = this.items.map(i => i.id);
			}
		},
		/**
		 * Add an active filter
		 *
		 * @param {String} param
		 * @param {mixed} value
		 */
		addFilter(param, value) {
			let newFilters = {...this.activeFilters};
			if (['status', 'isPublished', 'issueIds'].includes(param)) {
				// Handle "toggleable" or single select filters
				newFilters[param] = value;
			} else {
				// Handle multi-select filters
				if (!newFilters[param]) {
					newFilters[param] = [];
				}
				newFilters[param].push(value);
			}
			this.activeFilters = newFilters;
		},
		/**
		 * Is a filter currently active?
		 *
		 * @param {string} param The filter param
		 * @param {mixed} value The filter value
		 * @return {Boolean}
		 */
		isFilterActive: function(param, value) {
			if (!Object.keys(this.activeFilters).includes(param)) {
				return false;
			} else if (Array.isArray(this.activeFilters[param])) {
				return this.activeFilters[param].includes(value);
			} else {
				return this.activeFilters[param] === value;
			}
		},
		/**
		 * Remove an active filter
		 *
		 * @param {String} param
		 * @param {mixed} value
		 */
		removeFilter(param, value) {
			let newFilters = {...this.activeFilters};
			if (['status', 'isPublished', 'issueIds'].includes(param)) {
				// Handle "toggleable" filters
				delete newFilters[param];
			} else {
				// Handle multi-select filters
				newFilters[param] = newFilters[param].filter(v => v !== value);
			}
			this.activeFilters = newFilters;
		},
		/**
		 * Opens modal for bulk item depositing, also triggered by DoiListItem for depositing
		 *
		 * @param {number[]} itemIds
		 */
		openBulkDeposit(itemIds = []) {
			// NB: Special case, can be invoked by DoiListItem and pass along an array with an id
			const ids = itemIds.length > 0 ? itemIds : this.selected;

			const actionLabel = this.__('manager.dois.actions.deposit.label');
			const actionMessage = this.__('manager.dois.actions.deposit.prompt', {
				count: ids.length,
				registrationAgency: this.registrationAgencyInfo['displayName']
			});

			this.openDialog({
				cancelLabel: this.__('common.cancel'),
				confirmLabel: actionLabel,
				message: actionMessage,
				modalName: 'bulkActions',
				title: actionLabel,
				callback: () => {
					$.ajax({
						...this.getBulkActionAjaxProps('deposit'),
						data: {
							ids: ids
						},
						/**
						 * @param {{responseMessage: string}} response
						 */
						success: response => {
							pkp.eventBus.$emit(
								'notify',
								this.__(response.responseMessage),
								'success'
							);
						},
						error: response => this.ajaxErrorCallback(response),
						complete: () => this.onBulkActionComplete()
					});
				}
			});
		},
		/**
		 * Opens modal for bulk item exporting and handles downloads
		 */
		openBulkExport() {
			const actionLabel = this.__('manager.dois.actions.export.label');
			const actionMessage = this.__('manager.dois.actions.export.prompt', {
				count: this.selected.length,
				registrationAgency: this.registrationAgencyInfo['displayName']
			});

			this.openDialog({
				cancelLabel: this.__('common.cancel'),
				confirmLabel: actionLabel,
				message: actionMessage,
				modalName: 'bulkActions',
				title: actionLabel,
				callback: () => {
					$.ajax({
						...this.getBulkActionAjaxProps('export'),
						data: {
							ids: this.selected
						},
						/**
						 *
						 * @param {{temporaryFileId: int}} data
						 */
						success: data => {
							// Triggers GET request to download TemporaryFile with id of temporaryFileId
							const anchor = document.createElement('a');
							anchor.href = `${this.doiApiUrl}/exports/${data.temporaryFileId}`;
							document.body.appendChild(anchor);
							anchor.click();
							document.body.removeChild(anchor);

							pkp.eventBus.$emit(
								'notify',
								this.__('manager.dois.notification.exportSuccess'),
								'success'
							);
						},
						error: response => this.ajaxErrorCallback(response),
						complete: () => this.onBulkActionComplete()
					});
				}
			});
		},
		/**
		 * Opens modal for bulk marking items registered
		 */
		openBulkMarkRegistered() {
			const actionLabel = this.__('manager.dois.actions.markRegistered.label');
			const actionMessage = this.__(
				'manager.dois.actions.markRegistered.prompt',
				{count: this.selected.length}
			);

			this.openDialog({
				cancelLabel: this.__('common.cancel'),
				confirmLabel: actionLabel,
				message: actionMessage,
				modalName: 'bulkActions',
				title: actionLabel,
				callback: () => {
					$.ajax({
						...this.getBulkActionAjaxProps('markRegistered'),
						data: {
							ids: this.selected
						},
						success: () => {
							pkp.eventBus.$emit(
								'notify',
								this.__('manager.dois.notification.markRegisteredSuccess'),
								'success'
							);
						},
						error: response => this.ajaxErrorCallback(response),
						complete: () => this.onBulkActionComplete()
					});
				}
			});
		},
		/**
		 * Opens modal for bulk assigning new DOIs
		 */
		openBulkAssign() {
			const actionLabel = this.__('manager.dois.actions.assign.label');
			const actionMessage = this.__('manager.dois.actions.assign.prompt', {
				count: this.selected.length
			});

			this.openDialog({
				cancelLabel: this.__('common.cancel'),
				confirmLabel: actionLabel,
				message: actionMessage,
				modalName: 'bulkActions',
				title: actionLabel,
				callback: () => {
					$.ajax({
						...this.getBulkActionAjaxProps('assignDois'),
						data: {
							ids: this.selected
						},
						success: () => {
							pkp.eventBus.$emit(
								'notify',
								this.__('manager.dois.notification.assignDoisSuccess'),
								'success'
							);
						},
						error: response => this.ajaxErrorCallback(response),
						complete: () => this.onBulkActionComplete()
					});
				}
			});
		},
		/**
		 * Opens modal for bulk depositing all outstanding DOIs
		 */
		openBulkDepositAll() {
			const actionLabel = this.__('manager.dois.actions.depositAll.label');
			const actionMessage = this.__('manager.dois.actions.depositAll.prompt', {
				registrationAgency: this.registrationAgencyInfo['displayName']
			});

			this.openDialog({
				cancelLabel: this.__('common.cancel'),
				confirmLabel: actionLabel,
				message: actionMessage,
				modalName: 'bulkActions',
				title: actionLabel,
				callback: () => {
					$.ajax({
						url: `${this.doiApiUrl}/depositAll`,
						type: 'POST',
						headers: {
							'X-Csrf-Token': pkp.currentUser.csrfToken
						},
						success: () => {
							pkp.eventBus.$emit(
								'notify',
								this.__('manager.dois.notification.depositQueuedSuccess'),
								'success'
							);
						},
						error: response => this.ajaxErrorCallback(response),
						complete: () => this.onBulkActionComplete()
					});
				}
			});
		},
		/**
		 * Gets Actions used by all bulk action AJAX requests
		 *
		 * @param {string} action
		 * @returns {{headers: {"X-Csrf-Token": string}, type: string, url: string}}
		 */
		getBulkActionAjaxProps(action) {
			return {
				url: `${this.executeActionApiUrl}/${action}`,
				type: 'POST',
				headers: {
					'X-Csrf-Token': pkp.currentUser.csrfToken
				}
			};
		},
		/**
		 * Performs cleanup operations after bulk actions finish
		 */
		onBulkActionComplete() {
			this.$modal.hide('bulkActions');
			this.get();
			this.selected = [];
		},
		/**
		 *
		 * @param {Object} pubObject
		 */
		updateSuccessfulDoiEdits(pubObject) {
			let newItemsList = this.items.map(item => {
				return item.id === pubObject.id ? pubObject : item;
			});

			pkp.eventBus.$emit(
				'notify',
				this.__('manger.dois.update.success'),
				'success'
			);
			this.setItems(newItemsList, this.itemsMax);
		},
		/**
		 * The current publication of the submission
		 *
		 * @param submission
		 * @return {Object}
		 */
		getCurrentPublication(submission) {
			return submission.publications.find(
				publication => publication.id === submission.currentPublicationId
			);
		},
		// -- Mapped Items and related methods -- //
		/**
		 * Adds doiObjects to mapped item. Extended in app-specific component.
		 *
		 * @param {Object} mappedItem Mapped item
		 * @returns {Object} Modified mapped item
		 */
		addDoiObjects(mappedItem) {
			return mappedItem;
		},
		/**
		 * Gets the title to be used in mapped object. Extended in app-specific component.
		 *
		 * @param {Object} item Item being mapped
		 * @returns {String} title Title of the pubObject (used in DoiListItem)
		 */
		getItemTitle(item) {
			return this.getItemTitleBase(item);
		},
		/**
		 * Gets title to be used in mapped object. Assumes original object is submission.
		 *
		 * @param {Object} item Item being mapped
		 * @returns {String} Title of the publication (used in DoiListItem)
		 */
		getItemTitleBase(item) {
			const currentPublication = this.getCurrentPublication(item);
			const authorString = currentPublication.authorsStringShort;
			const title = this.localize(currentPublication.fullTitle);
			return `${authorString} — ${title}`;
		},
		/**
		 * Gets the pubObject's published URL—to be used in mapped object. Extended in app-specific component.
		 *
		 * @param {Object} item Item being mapped
		 * @returns {String} URL of the pubObject (used in DoiListItem)
		 */
		getUrlPublished(item) {
			return this.getUrlPublishedBase(item);
		},
		/**
		 * Gets the pubObject's published URL—to be used in mapped object. Assumes original object is submission.
		 *
		 * @param {Object} item Item being mapped
		 * @returns {String} URL of the pubObject (used in DoiListItem)
		 */
		getUrlPublishedBase(item) {
			return this.getCurrentPublication(item).urlPublished;
		},
		/**
		 * Gets the pubObject's publication status—to be used in mapped object. Extended in app-specific component.
		 *
		 * @param {Object} item Item being mapped
		 * @returns {Boolean} Publication status of pubObject
		 */
		getIsPublished(item) {
			return this.getIsPublishedBase(item);
		},
		/**
		 * Gets the pubObject's publication status—to be used in mapped object. Assumes original object is submission.
		 *
		 * @param {Object} item Item being mapped
		 * @returns {Boolean} Publication status of pubObject
		 */
		getIsPublishedBase(item) {
			return item.status === pkp.const.STATUS_PUBLISHED;
		}
	},
	computed: {
		isAllSelected() {
			return this.selected.length && this.selected.length === this.items.length;
		},
		isAllExpanded() {
			return this.expanded.length && this.expanded.length === this.items.length;
		},
		mappedItems() {
			return this.items.map(item => {
				let newItem = {
					id: item.id,
					type: this.itemType,
					title: this.getItemTitle(item),
					urlPublished: this.getUrlPublished(item),
					isPublished: this.getIsPublished(item),
					doiObjects: []
				};
				newItem = this.addDoiObjects(newItem);

				return newItem;
			});
		},
		isRegistrationPluginConfigured() {
			return this.registrationAgencyInfo['isConfigured'];
		}
	}
};
</script>

<style lang="less">
@import '../../../styles/_import';

.doiListPanel__options {
	display: flex;
	margin-top: 0.5rem;
}

.doiListPanel__options--button {
	margin-left: 0.25rem;
}

.doiListPanel__bulkActions .pkpDropdown__content {
	right: 0;
}

body[dir='rtl'] .doiListPanel__bulkActions .pkpDropdown__content {
	right: auto;
	left: 0;
}
</style>
