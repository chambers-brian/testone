/**
 * ValidateDataContent.jsx
 * Created by Mike Bray 3/28/16
 **/

import React, { PropTypes } from 'react';
import { kGlobalConstants } from '../../GlobalConstants.js';
import SubmitButton from '../SharedComponents/SubmitButton.jsx';
import Table from '../SharedComponents/table/TableComponent.jsx';
import _ from 'lodash';

const propTypes = {

};

export default class ValidateDataErrorReport extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            sortDirection: 'asc'
        };
    }

    openWindow() {
        window.open(this.props.link, '_blank');
    }

    sortTable(direction) {
        if (direction != this.state.sortDirection) {
            this.setState({
                sortDirection: direction
            });
        }
    }

    render() {
                
        let tables = '';

        if (this.props.data.length > 0) {
            tables = this.props.data.map((errorData, index) => {

                let rowData = errorData.data;
                if (this.state.sortDirection != 'asc') {
                    // reverse the array
                    rowData = _.reverse(_.clone(errorData.data));
                }

                let rows = [];
                rowData.forEach((row) => {
                    rows.push([row]);
                });

                return <Table headers={[errorData.header]} data={rows} key={index} sortable={true} onSort={this.sortTable.bind(this)} />
            });
            
        }

        return (
            <div className="row usa-da-validate-item-bottom-section">
                <div className="row usa-da-validate-error-report">
                    <div className="row center-block">
                        <div className="col-md-10">
                            <h3>Header Error Report</h3>
                        </div>
                        <div className="col-md-2">
                            <button onClick={this.openWindow.bind(this)} className="usa-button-secondary">Download Error Report</button>
                        </div>
                        <div className="col-md-12">
                            {tables}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

ValidateDataErrorReport.propTypes = propTypes;